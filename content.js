/// <summary>
/// Content script that runs on csfloat.com. Handles bulk-adding listings to
/// the cart and emptying the cart completely.
/// </summary>
(function ()
{
	// Prevent the script from initialising more than once.
	if (window.__csfloatBulkLoaded)
	{
		return;
	}
	window.__csfloatBulkLoaded = true;

	//#region Members & Properties

	/// <summary>
	/// The supported message types between the popup and this content script.
	/// </summary>
	const MessageType = Object.freeze(
	{
		Add: "csfloat-add",
		RemoveAll: "csfloat-remove-all"
	});

	//#endregion Members & Properties

	//#region Protected Functions

	/// <summary>
	/// Waits for the given number of milliseconds.
	/// </summary>
	function Sleep(iMilliseconds)
	{
		return new Promise(function (oResolve)
		{
			setTimeout(oResolve, iMilliseconds);
		});
	}

	/// <summary>
	/// Combines the relevant textual properties of an element so it can be
	/// searched by keyword.
	/// </summary>
	function HaystackOf(oElement)
	{
		// Merge all sources and return them in lower case.
		const sAria = oElement.getAttribute("aria-label") || "";
		const sTitle = oElement.getAttribute("title") || "";
		const sText = oElement.textContent || "";
		const sHtml = oElement.innerHTML || "";

		return (sAria + " " + sTitle + " " + sText + " " + sHtml).toLowerCase();
	}

	/// <summary>
	/// Determines whether an element is an "add to cart" button.
	/// </summary>
	function IsAddButton(oElement)
	{
		if (!oElement)
		{
			return false;
		}

		const sHaystack = HaystackOf(oElement);

		// A remove button also contains "shopping_cart"; exclude it first.
		if (sHaystack.includes("remove_shopping_cart") ||
			sHaystack.includes("remove from cart"))
		{
			return false;
		}

		return (
			sHaystack.includes("add_shopping_cart") ||
			sHaystack.includes("add to cart") ||
			sHaystack.includes("addtocart") ||
			sHaystack.includes("shopping_cart"));
	}

	/// <summary>
	/// Determines whether a button is disabled.
	/// </summary>
	function IsDisabled(cBtn)
	{
		return (
			cBtn.disabled ||
			cBtn.getAttribute("aria-disabled") === "true" ||
			cBtn.classList.contains("mat-button-disabled") ||
			cBtn.classList.contains("mat-mdc-button-disabled"));
	}

	/// <summary>
	/// Returns all clickable elements on the page.
	/// </summary>
	function ClickableElements()
	{
		return Array.from(document.querySelectorAll("button, [role='button'], a"));
	}

	/// <summary>
	/// Returns all item cards in DOM order (which equals the visual order on
	/// the page).
	/// </summary>
	function FindCards()
	{
		// CSFloat renders listings as <item-card> components.
		const arrCards = Array.from(document.querySelectorAll("item-card"));
		if (arrCards.length > 0)
		{
			return arrCards;
		}

		// Fallback: derive the cards from the discovered "add to cart" buttons.
		const lstButtons = ClickableElements().filter(IsAddButton);
		const oSet = new Set();
		for (const cBtn of lstButtons)
		{
			const oCard =
				cBtn.closest("item-card, .item, .listing, [class*='card']") ||
				cBtn.parentElement;
			if (oCard)
			{
				oSet.add(oCard);
			}
		}

		return Array.from(oSet);
	}

	/// <summary>
	/// Finds the button inside a single card that matches the predicate.
	/// </summary>
	function FindButtonInCard(oCard, fnPredicate)
	{
		const lstCandidates = Array.from(
			oCard.querySelectorAll("button, [role='button'], a"));

		return lstCandidates.find(fnPredicate) || null;
	}

	/// <summary>
	/// Returns the line items that are present in the checkout overlay (the
	/// cart).
	/// </summary>
	function CheckoutItems()
	{
		const oOverlay = document.querySelector(".cdk-overlay-container") || document;

		return Array.from(oOverlay.querySelectorAll(".content .item, .item")).filter(
			function (oItem)
			{
				return oItem.querySelector(".remove, [svgicon='delete']") !== null;
			});
	}

	/// <summary>
	/// Finds the "Clear" button at the bottom of the checkout overlay; it
	/// empties the entire cart in one go.
	/// </summary>
	function FindClearButton()
	{
		const lstButtons = Array.from(document.querySelectorAll("button"));

		return lstButtons.find(function (cBtn)
		{
			return (cBtn.textContent || "").trim().toLowerCase() === "clear";
		}) || null;
	}

	/// <summary>
	/// Returns the individual remove buttons inside the checkout overlay.
	/// </summary>
	function FindRemoveButtons()
	{
		const oOverlay = document.querySelector(".cdk-overlay-container") || document;
		const lstButtons = Array.from(oOverlay.querySelectorAll(".remove button, button"));

		return lstButtons.filter(function (cBtn)
		{
			return cBtn.querySelector(
				"[svgicon='delete'], [data-mat-icon-name='delete']") !== null;
		});
	}

	/// <summary>
	/// Determines whether the checkout overlay is currently open.
	/// </summary>
	function CheckoutIsOpen()
	{
		return (FindClearButton() !== null || FindRemoveButtons().length > 0);
	}

	/// <summary>
	/// Finds the cart toggle in the navigation. The toggle is an icon-only
	/// "hoverable-btn" link, so it is matched on its markup rather than text.
	/// </summary>
	function FindCartToggle()
	{
		const lstButtons = Array.from(
			document.querySelectorAll("a.hoverable-btn, button.hoverable-btn"))
			.filter(function (oElement)
			{
				return !oElement.closest(".cdk-overlay-container");
			});

		// Strongest signal: the cart icon contains a distinctive pair of wheel arcs.
		const cByIcon = lstButtons.find(function (oElement)
		{
			return oElement.outerHTML.includes("19C11 20.1046");
		});
		if (cByIcon)
		{
			return cByIcon;
		}

		// Fallback: the cart is the toggle that carries an item-count badge.
		const lstBadged = lstButtons.filter(function (oElement)
		{
			return oElement.querySelector(".mat-badge") !== null;
		});
		if (lstBadged.length > 0)
		{
			return lstBadged[lstBadged.length - 1];
		}

		// Last resort: a keyword match on any clickable element.
		return ClickableElements().find(function (oElement)
		{
			if (oElement.closest("item-card") || oElement.closest(".cdk-overlay-container"))
			{
				return false;
			}
			return HaystackOf(oElement).includes("shopping_cart");
		}) || null;
	}

	/// <summary>
	/// Attempts to open the cart by clicking the cart toggle in the navigation.
	/// </summary>
	function OpenCart()
	{
		const cToggle = FindCartToggle();
		if (cToggle)
		{
			cToggle.click();
			return true;
		}

		return false;
	}

	/// <summary>
	/// Closes the checkout overlay by clicking its backdrop, falling back to an
	/// Escape key press.
	/// </summary>
	function CloseCart()
	{
		const oBackdrop = document.querySelector(".cdk-overlay-backdrop");
		if (oBackdrop)
		{
			oBackdrop.click();
			return;
		}

		document.dispatchEvent(new KeyboardEvent("keydown",
		{
			key: "Escape",
			keyCode: 27,
			bubbles: true
		}));
	}

	//#endregion Protected Functions

	//#region Global Functions

	/// <summary>
	/// Scrolls the page down to trigger lazy-loading until at least iCount
	/// cards are present, or until no more cards load.
	/// </summary>
	async function EnsureCardsLoaded(iCount)
	{
		let iLast = FindCards().length;
		let iStable = 0;

		// Keep scrolling while we need more cards and new ones keep loading.
		while (FindCards().length < iCount && iStable < 4)
		{
			window.scrollTo(0, document.documentElement.scrollHeight);
			await Sleep(500);

			const iNow = FindCards().length;
			if (iNow > iLast)
			{
				iLast = iNow;
				iStable = 0;
			}
			else
			{
				// No growth this round; allow a few retries before giving up.
				iStable++;
			}
		}

		// Return to the top so adding starts from the first listing.
		window.scrollTo(0, 0);
	}

	/// <summary>
	/// Loads enough cards and then adds the first iCount listings to the cart.
	/// </summary>
	async function AddFirst(iCount)
	{
		await EnsureCardsLoaded(iCount);
		return ClickFirst(iCount, IsAddButton);
	}

	/// <summary>
	/// Clicks the first iCount buttons that match the predicate as fast as
	/// possible, in card order.
	/// </summary>
	function ClickFirst(iCount, fnPredicate)
	{
		const arrCards = FindCards();
		let iClicked = 0;
		let iSkipped = 0;

		for (let i = 0; i < arrCards.length && iClicked < iCount; i++)
		{
			const cBtn = FindButtonInCard(arrCards[i], fnPredicate);
			if (!cBtn)
			{
				continue;
			}

			// Skip disabled (e.g. unavailable) listings.
			if (IsDisabled(cBtn))
			{
				iSkipped++;
				continue;
			}

			cBtn.click();
			iClicked++;
		}

		return { clicked: iClicked, skipped: iSkipped, totalCards: arrCards.length };
	}

	/// <summary>
	/// Empties the entire cart. Opens the checkout overlay first if needed and
	/// then clicks "Clear" (falling back to the individual remove buttons).
	/// </summary>
	async function RemoveAll()
	{
		// 1) Make sure the checkout overlay is open.
		if (!CheckoutIsOpen())
		{
			OpenCart();
			for (let i = 0; i < 25 && !CheckoutIsOpen(); i++)
			{
				await Sleep(100);
			}
		}

		// 2) Count the items and try to empty the cart in one go.
		const iCount = CheckoutItems().length;
		const cClear = FindClearButton();
		if (cClear && !IsDisabled(cClear))
		{
			cClear.click();
			await Sleep(200);
			CloseCart();
			return { clicked: iCount, cleared: true };
		}

		// 3) Fallback: keep clicking the first remove button, because the list
		// is re-rendered by Angular after every removal.
		let iClicked = 0;
		for (let i = 0; i < 500; i++)
		{
			const lstButtons = FindRemoveButtons().filter(function (cBtn)
			{
				return !IsDisabled(cBtn);
			});
			if (lstButtons.length === 0)
			{
				break;
			}

			lstButtons[0].click();
			iClicked++;
			await Sleep(30);
		}

		await Sleep(200);
		CloseCart();
		return { clicked: iClicked, cleared: false };
	}

	/// <summary>
	/// Handles an incoming message from the popup and sends the result back.
	/// </summary>
	function HandleMessage(oMessage, oSender, fnSendResponse)
	{
		switch (oMessage.type)
		{
			case MessageType.Add:
				AddFirst(oMessage.count)
					.then(function (oResult)
					{
						fnSendResponse(Object.assign({ ok: true }, oResult));
					})
					.catch(function (oError)
					{
						fnSendResponse({ ok: false, error: String(oError) });
					});
				return true; // Asynchronous response.

			case MessageType.RemoveAll:
				RemoveAll()
					.then(function (oResult)
					{
						fnSendResponse(Object.assign({ ok: true }, oResult));
					})
					.catch(function (oError)
					{
						fnSendResponse({ ok: false, error: String(oError) });
					});
				return true; // Asynchronous response.

			default:
				return false;
		}
	}

	//#endregion Global Functions

	chrome.runtime.onMessage.addListener(HandleMessage);
})();
