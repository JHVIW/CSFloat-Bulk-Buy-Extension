/// <summary>
/// Drives the popup: reads the input, sends commands to the content script and
/// shows the status messages.
/// </summary>
(function ()
{
	//#region Members & Properties

	/// <summary>
	/// The supported message types between the popup and the content script.
	/// </summary>
	const MessageType = Object.freeze(
	{
		Add: "csfloat-add",
		RemoveAll: "csfloat-remove-all"
	});

	/// <summary>
	/// The possible appearances of a status message.
	/// </summary>
	const StatusKind = Object.freeze(
	{
		Neutral: "neutral",
		Success: "success",
		Error: "error"
	});

	// Look up the frequently used controls once.
	const m_cStatus = document.getElementById("status");
	const m_cCount = document.getElementById("count");
	const m_cAdd = document.getElementById("add");
	const m_cRemove = document.getElementById("remove");

	//#endregion Members & Properties

	//#region Protected Functions

	/// <summary>
	/// Shows a status message with the desired appearance.
	/// </summary>
	function SetStatus(sMessage, sKind)
	{
		m_cStatus.textContent = sMessage;
		m_cStatus.className = "status is-visible";

		switch (sKind)
		{
			case StatusKind.Success:
				m_cStatus.classList.add("is-success");
				break;
			case StatusKind.Error:
				m_cStatus.classList.add("is-error");
				break;
			default:
				// Neutral message: no extra class.
				break;
		}
	}

	/// <summary>
	/// Returns the active tab in the current window.
	/// </summary>
	async function GetActiveTab()
	{
		const arrTabs = await chrome.tabs.query({ active: true, currentWindow: true });
		return arrTabs[0];
	}

	/// <summary>
	/// Checks whether the tab is a CSFloat page.
	/// </summary>
	function EnsureCsfloat(oTab)
	{
		if (!oTab || !oTab.url || !oTab.url.startsWith("https://csfloat.com/"))
		{
			SetStatus("Open a CSFloat page first (csfloat.com).", StatusKind.Error);
			return false;
		}

		return true;
	}

	/// <summary>
	/// Sends a message to the content script and injects that script when it is
	/// not active yet.
	/// </summary>
	async function SendMessage(oTab, oMessage)
	{
		try
		{
			return await chrome.tabs.sendMessage(oTab.id, oMessage);
		}
		catch (oError)
		{
			// Content script not loaded yet: inject it and send again.
			await chrome.scripting.executeScript(
			{
				target: { tabId: oTab.id },
				files: ["content.js"]
			});
			return await chrome.tabs.sendMessage(oTab.id, oMessage);
		}
	}

	/// <summary>
	/// Enables or disables both action buttons.
	/// </summary>
	function SetBusy(bBusy)
	{
		m_cAdd.disabled = bBusy;
		m_cRemove.disabled = bBusy;
	}

	/// <summary>
	/// Builds a plural suffix for the message.
	/// </summary>
	function Plural(iCount)
	{
		return (iCount === 1 ? "" : "s");
	}

	/// <summary>
	/// Updates the add button label to reflect the configured number of items.
	/// </summary>
	function UpdateAddLabel()
	{
		const iCount = Number(m_cCount.value) || 25;
		m_cAdd.textContent = "Add first " + iCount + " to cart";
	}

	//#endregion Protected Functions

	//#region Global Functions

	/// <summary>
	/// Adds the first N listings to the cart.
	/// </summary>
	async function AddToCart()
	{
		const oTab = await GetActiveTab();
		if (!EnsureCsfloat(oTab))
		{
			return;
		}

		const iCount = Number(m_cCount.value) || 25;

		SetBusy(true);
		SetStatus("Adding to cart…", StatusKind.Neutral);

		try
		{
			const oResult = await SendMessage(oTab, { type: MessageType.Add, count: iCount });
			if (oResult && oResult.ok)
			{
				let sMessage =
					"Added " + oResult.clicked + " item" + Plural(oResult.clicked) + " to cart.";
				if (oResult.skipped)
				{
					sMessage += "\nSkipped " + oResult.skipped + " (unavailable).";
				}
				SetStatus(sMessage, StatusKind.Success);
			}
			else
			{
				SetStatus("Error: " + (oResult && oResult.error), StatusKind.Error);
			}
		}
		catch (oError)
		{
			SetStatus("Error: " + oError.message, StatusKind.Error);
		}
		finally
		{
			SetBusy(false);
		}
	}

	/// <summary>
	/// Empties the entire cart.
	/// </summary>
	async function RemoveFromCart()
	{
		const oTab = await GetActiveTab();
		if (!EnsureCsfloat(oTab))
		{
			return;
		}

		SetBusy(true);
		SetStatus("Removing from cart…", StatusKind.Neutral);

		try
		{
			const oResult = await SendMessage(oTab, { type: MessageType.RemoveAll });
			if (oResult && oResult.ok)
			{
				const sMessage = (oResult.clicked > 0)
					? "Removed " + oResult.clicked + " item" + Plural(oResult.clicked) + " from cart."
					: "No items in cart found on this page.";
				SetStatus(sMessage, StatusKind.Success);
			}
			else
			{
				SetStatus("Error: " + (oResult && oResult.error), StatusKind.Error);
			}
		}
		catch (oError)
		{
			SetStatus("Error: " + oError.message, StatusKind.Error);
		}
		finally
		{
			SetBusy(false);
		}
	}

	//#endregion Global Functions

	// Wire up the events. The count always starts at the default in the markup.
	m_cAdd.addEventListener("click", AddToCart);
	m_cRemove.addEventListener("click", RemoveFromCart);
	m_cCount.addEventListener("input", UpdateAddLabel);
	UpdateAddLabel();
})();
