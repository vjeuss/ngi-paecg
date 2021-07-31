var currentUrl;
var currentDomain;
var userId;
var userToken;
var userAllReceipts = [];
var currentDomainReceipts = [];
var isSupported;
var lastPolicyUpdateDate;

/*
* Gets necessary information from the currenly visitng page
*/
sendMessageToRuntime('getUserId_Token');
sendMessageToCurrentTab('getCurrentPageInfo');


/*
* When get all receipts button is clicked
*/

$("#showAllReceipts").on('click', function () {
	$('#receiptArea').html(``);
	getAllReceiptsFromCloud();
});

/* 
*When show current receipts button is pressed
*/
$("#showCurrentDomainReceipts").on('click', function () {
	$('#receiptArea').html(``);
	getCurrentDomainReceiptsFromCloud()
});

function getAllReceiptsFromLocalStorage() {
	chrome.storage.local.get(null, function (items) {
		for (var key in items) {
			if (items.hasOwnProperty(key)) {
				let currentreceipt = items[key];
				userAllReceipts.push(currentreceipt);
				if (currentreceipt.domain == currentDomain) {
					currentDomainReceipts.push(currentDomainReceipts);
				}
			}
		}
	});
	console.log("Loaded from Local Stoage");
	console.log(userAllReceipts);
}

/**
 * Gets all the receipts from the cloud of the currently visiting website
 */
function getAllReceiptsFromCloud() {
	/**
 * Sends post receipts to the cloud storage and retrives all the receipts in a array, sorted by their timestamp
 * @param  userId  userId of the User
 * @param  userToken token of the user
 */
	$.post('http://3.10.208.186:1001/api/get', {
		userId: userId,
		userToken: userToken,
	}).done(function (msg) {
		userAllReceipts = msg;
		showReceipts(msg);
	})
		.fail(function (xhr, status, error) {
			// error handling
			console.log(error);
		});

}

/**
 * Gets all the receipts from the cloud of the currently visiting website
 */
function getCurrentDomainReceiptsFromCloud() {
	/**
	 * Sends post receits to the cloud storage and retrives all the receipts of currenlt visiting website in a array, sorted by their timestamp
	 * @param  userId  userId of the User
	 * @param  userToken token of the user
	 * @param  currentDomain  current domain
	 */
	$.post('http://3.10.208.186:1001/api/get', {
		userId: userId,
		userToken: userToken,
		domain: currentDomain
	})
		.done(function (msg) {
			currentDomainReceipts = msg;
			showReceipts(msg);
		})
		.fail(function (xhr, status, error) {
			// error handling
			console.log(error);
		});
}

function gatherNecessaryInfo() {
	if (typeof currentUrl !== "undefined") {
		getCurrentDomainReceiptsFromCloud();
	}
	else {
		setTimeout(gatherNecessaryInfo, 250);
	}
}
gatherNecessaryInfo();


/**
 * Show the receipts in the popup
 * @param  {} msg Array of Receipts retrived from  the cloud
 */
function showReceipts(msg) {
	if (msg.length == 0) {
		$('#receiptArea').html(`<div class="col-12"> <p>No receipts found for this site<p></div>`);

		//Hide what user did last time
		$("#userLastAction").hide();
		$("#consentStatusBox").hide();

	}
	else {
		//if there are receipts for this website then show all receipts in the addon popup

		msg.forEach(element => {
			$('#receiptArea').append(
				`<div class="receipt_file col-2">
			<div class="row">
				<div class="col-6">
					<i class="material-icons">description</i>
				</div>
			</div>
			<div class="row">
				<div class="col-6"> <i class="fa fa-download" id='downloadbtnid${element._id}' style="font-size:24px;color:#007bff;cursor: pointer;"></i></div>
				<div class="col-6"> <i class="fa fa-eye" id='viewbtnid${element._id}' style="font-size:24px;cursor: pointer;color:#007bff;"></i></div>

			</div>
		</div>`);
			document.getElementById(`id${element._id}`)
			var downloadbtnname = `#downloadbtnid${element._id}`
			var viewbtnname = `#viewbtnid${element._id}`
			$(downloadbtnname).on('click', function () {
				$(downloadbtnname).slideUp();
				$(downloadbtnname).slideDown();
				downloadReceipt(JSON.stringify(element.receipt), Date.now());
			});
			$(viewbtnname).on('click', function () {
				var winPrint = window.open('', '', 'left=0,top=0,width=800,height=600,toolbar=0,scrollbars=0,status=0');
				var text = winPrint.document.createTextNode(JSON.stringify(element.receipt));//JSON.stringify(JSON.parse(element.receipt), null, 4));
				winPrint.document.body.appendChild(text);	
				winPrint.document.close();

			});
		});
		console.log(msg);

		// If the website supports protocol show this
		let lastReceiptDate = new Date(parseInt(currentDomainReceipts[0].created_date));
		if (isSupported) {
			$("#userLastAction").html(`You clicked on ${currentDomainReceipts[0].consentText} last time on ${lastReceiptDate}`)
			$("#consentStatusBox").show();
		}
		// If the website does not support show this
		else {
			$("#consentStatusBox").hide();
			$("#userLastAction").html(`This Receipt was generated on ${lastReceiptDate}`)
		}


		//show if the policy has changed after last time
		if (lastPolicyUpdateDate != '') {
			if (currentDomainReceipts.length > 0) {
				// if there is new update after the user accepted the receipt last time
				if (parseInt(currentDomainReceipts[0].created_date) > Date.parse(lastPolicyUpdateDate)) {
					$("#consentStatusBox").removeClass("alert-secondary").addClass("alert-success");
					$("#consentStatusBox").html("Since last aggreement, no changes have been made");
				}
				else {
					$("#consentStatusBox").removeClass("alert-secondary").addClass("alert-warning");
					$("#consentStatusBox").html("Changes to the policy, please regenerate receipt");
				}
			}
			else {
				$("#consentStatusBox").removeClass("alert-secondary").addClass("alert-danger");
				$("#consentStatusBox").html("No Information Avaible");
			}
		}
	}
}
/**
 * Asks users to save the receipts in their device
 * @param  {} data receipt data
 * @param  {} filename receipt file name
 * 
 */
function downloadReceipt(data, filename) {
	var file = new Blob([data], { type: "application/json" });
	var a = document.createElement("a")
	var url = URL.createObjectURL(file);
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	setTimeout(function () {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 0);
}

// Sends message to current tab 
function sendMessageToCurrentTab(title = "", message = "") {
	chrome.tabs.query({
		active: true,
		currentWindow: true
	}, function (tabs) {
		chrome.tabs.sendMessage(tabs[0].id, {
			title: title,
			data: message
		});
	});
}

function sendMessageToRuntime(title, data) {
	chrome.runtime.sendMessage({
		title: title,
		data: data
	});
}


chrome.runtime.onMessage.addListener(
	function (receivedMessage, sender, sendResponse) {
		var msgdata = receivedMessage.data
		if (receivedMessage.title == "pageInfoResponse") {
			currentUrl = msgdata.fullUrl;
			currentDomain = msgdata.domain;
			lastPolicyUpdateDate = msgdata.lastPolicyUpdateDate;
			isSupported = msgdata.isSupported;


			// if the website supports protocol do the following 
			if (msgdata.isSupported) {
				$("#supportedIcon").removeClass("badge-secondary").addClass("badge-success");
				$("#supportedIcon").text("Supported");
				$("#updateDate").html(`<p>Last policy change date: ${lastPolicyUpdateDate} <p>`);

			}
			// if the website does not follow the protocol do the follwing
			else {
				//change the icon text to not supported and red color
				$("#supportedIcon").removeClass("badge-secondary").addClass("badge-danger");
				$("#supportedIcon").text("Not Supported");

				// add generate receipt button in the UI

				$("#generate_receipt_section").html(`<button class="badge badge-pill badge-secondary" id="generateReceiptNonComplaint">Generate Receipt</button>`);
				$("#generateReceiptNonComplaint").on('click', function () {
					sendMessageToCurrentTab("generateReceipt");
				});
				//More Information 
				$("#consentStatusBox").removeClass("alert-secondary").addClass("alert-danger");
				$("#consentStatusBox").html("No Receipt Found for this Website");

			}
		}
		if (receivedMessage.title == "UserId_TokenResponse") {
			userId = msgdata.userId;
			userToken = msgdata.userToken;
		}
	});






