/**
 * Table of Content (Find the given title in the code)
 * 1. Variables Explained
 * 2.  Complaint Website
 * 3. Non Complaint Website
 * 
 */

/* 1. Variable Explained
javascriptCodeHash= Hash of all the Javascript Included in the page
policyHash = Hash of all the policy content in the page
htmlHash = Hash of HTML of the page
allHash =  javascriptCodeHash + policyHash +htmlHash
PIIHash = Hash of personal data being used
PII = Personal Data
allPolicyLinks = All the links of policy Url included 
allJavascriptUrls = All the javascript links
htmlContent = HTML of the page
websocket = Websocket used to communicate the receipt information (Either with Own receipt generator or with trust parties like Consent Gateway)
clickedElement= ElementId of the html element responsible for handeling the interaction
info_for_receipt = Information that needs to be in the receipt (for future works)  datatype:JSON
receiptId

lastPolicyUpdateDate=  Date when the website updated it's privacy policy
supportsProtocol = checks if website supports the PAE:CG protocol


*/
var javascriptCodeHash, policyHash, htmlHash, allHash, PIIHash, PII, pispUrl, allPolicyLinks,
	allJavascriptUrls, htmlContent, websocket, timestamp, nounce,clickedElement,info_for_receipt,receiptId,website_type;
var allJavascriptContent = allPolicyContent =lastPolicyUpdateDate = consentText=''; //All javascipt content of the page
var supportsProtocol = isSupportedWebsite();


/**
 * This function checks if the website supports  protocol or not
 * @returns {boolean} true is supported, false is not supported
 * 
 */
function isSupportedWebsite() {
	return (($("meta[name='pisp']")).length > 0);
}


async function gatherJavascriptFiles(allFiles) {
	allJavascriptContent = '';
	for (let javascriptUrl of allFiles) {
		let javascriptCode = await getCodeFromUrl(javascriptUrl);
		allJavascriptContent += javascriptCode;
	}
}
async function gatherPolicyFiles(allFiles) {
	allPolicyContent = '';
	for (let policyUrl of allFiles) {
		let policyUrlContent = await getCodeFromUrl(policyUrl);
		allPolicyContent += policyUrlContent;
	}
}

async function getHtml() {
	htmlContent = await getCodeFromUrl(window.location.href);
}

async function hashContents() {
	javascriptCodeHash = await sha256(allJavascriptContent);
	policyHash = await sha256(allPolicyContent);
	htmlHash = await sha256(htmlContent);
	PIIHash = await sha256(JSON.stringify(PII));
	allHash = policyHash + htmlHash + javascriptCodeHash + PIIHash;
}

async function getCodeFromUrl(file) {
	var res = await fetch(file);
	res = await res.text();
	return res.toString(16);
}


/**
 * Downloads files in the client device
 * @param  {} data receipt data
 * @param  {} filename name of the receipt
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

/**
 * Generates uuid
 * @returns {String}
 */
function Generateuuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * sends message to the background script
 * @param  {} title - title of the message
 * @param  {} data - data with the message
 */
function sendMessageToBackground(title, data) {
	try {
		chrome.runtime.sendMessage({
			title: title,
			data: data
		});
	}
	catch (err) {
		console.debug('caught err', err)
	}
}

/**
 * Checks if authenticity of the signed message 
 * 
 * @returns {boolean}
 * */
function verify_signed_message(message_data) {
	let server_public_key = forge.pki.publicKeyFromPem(message_data.data.server_publickeypem);
	let server_signed_message = message_data.data.signedMessage;
	/* If hashes matched the html content, javascript content, policy content and personal data
	 involved will be the same when they were gather independently */
	let consent_details = {
		htmlContent: htmlContent, javascript: allJavascriptContent, policy: allPolicyContent, PII: PII, timestamp: message_data.data.timestamp, nounce: message_data.data.nounce,info_for_receipt:info_for_receipt
	};
	let messageDigest = forge.md.sha256.create();
	messageDigest.update(consent_details, 'utf8');
	let verify = server_public_key.verify(messageDigest.digest().bytes(), server_signed_message);
	return verify;
}

/*
 ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑    END of Commom functions ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
---------------------------------------------------------------------------------- 
↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓ Complaint Websites ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
 */

/* 
Compliant Websites using HTML semantics
When Submit button is clicked on the website 
*/
function handelClickOnComplaint() {
	consentText = this.value;
	//gets details about the page and consent using the semantics
	info_for_receipt=gatherReceiptData();
	PII = info_for_receipt.instances;
	allPolicyLinks = [info_for_receipt.controller.privacy_policy];
	allJavascriptUrls = [];
	// Getting all src from all the script tags from the page not need to inclue in page script as html of the page is being also captured
	Array.prototype.slice.call(document.scripts).forEach(element => {
		if (element.src != "") {
			allJavascriptUrls.push(element.src);
		}
	});
	generateReceiptForCompliant();
}


/*
Compliant Websites using HTML semantics
Gathers information about the page and consent being given
*/
function gatherReceiptData() {
	try {
		// retrieve metadata from page for receipt generation
		console.log("Function collects data from elements on page");
		var consent_dialog = document.querySelector("[data-type='consent-dialog']");

		// the consent map is akin to PII in existing browser addon code
		// it represents the data that is captured within a record/receipt
		// it is based on a lot of assumptions, e.g. single controller
		var consent = {
			// data common to all choices on page
			"controller": {
				"name": document.getElementById(consent_dialog.getAttribute('data-controller')).textContent,
				"contact": document.getElementById(consent_dialog.getAttribute('data-contact')).textContent,
				"address": document.getElementById(consent_dialog.getAttribute('data-address')).textContent,
				"url": document.getElementById(consent_dialog.getAttribute('data-controller')).href,
				"privacy_policy": document.getElementById(consent_dialog.getAttribute('data-policy')).href,
				"terms": document.getElementById(consent_dialog.getAttribute('data-terms')).href
			},
			"rights": {
				"withdrawal": consent_dialog.querySelector("[data-type='consent-withdrawal'").href
			},
			// instances represent each independent choice for consent
			"instances": [],
			// status of consent dialog as a whole 
			// in relevance to when the record is created
			// could be first request, or given, or subsequent modification
			"status": "requested"
		};
		var consent_fields = document.querySelectorAll("[data-type='consent-request']");
		for (var fields of consent_fields) {
			var instance = {
				"choice_indication": fields.querySelector("[data-type='consent-choice']").getAttribute('type'),
				"consent_value": fields.querySelector("[data-type='consent-choice']").checked,
				"purposes": Array.from(fields.querySelectorAll("[data-type='purpose']")).map(x => x.textContent),
				"processing": Array.from(fields.querySelectorAll("[data-type='processing']")).map(x => x.textContent),
				"processing_conditions": Array.from(fields.querySelectorAll("[data-type='processing'][data-context]")).map(x => x.getAttribute("data-context")),
				"personal_data": Array.from(fields.querySelectorAll("[data-type='personal-data']")).map(x => [x.textContent, x.getAttribute("data-context")]),
				"processors": Array.from(fields.querySelectorAll("[data-type='processor']")).map(x => [x.textContent, x.href]),
			};
			consent.instances.push(instance)
		}
	}
	catch (err) {
		consent = {};

	}
	return consent;
}


/**
 * Complaint Website
 * 
 * 
 * Generates Receipts for the complaint website
 * does following task :
 *	gather necessary files
 *	hash them
 *	exchange messages with server(own) or consent gateway
 *  checks if the hashes are same (if yes) signs and send message to the server. 
 * 	checks if the signature sent by server is valid (if yes) generates the receipt
 * 	downloads the receipt
 */
function generateReceiptForCompliant() {
	timestamp=new Date().getTime();
	console.log('Generate Receipt For Compliant');
	/* Run the Protocol*/
	Promise.all([gatherJavascriptFiles(allJavascriptUrls), gatherPolicyFiles(allPolicyLinks), getHtml()]).then(() => {
		hashContents().then(() => {
			console.log("Hasing Completed By Client");
			//When pispUrl is 'Consent Gateway' then contact consent gateway to generate receipt
			if (pispUrl == 'Consent Gateway') {
				pispUrl = 'ws://46.101.26.188';
			}
			//creating connection with the server to generate receipt
			websocket = new WebSocket(pispUrl);
			websocket.addEventListener("open", () => {
				console.log("Connection made with the server");
				//send hashes to the server
				//if consent gateway is involved then send the website type if it is complaint or not
				let messageToSend = { 'title': 'getContentsAndHash', 'data': { 'info_for_receipt':info_for_receipt,'consentText': consentText, 'clickedElement': clickedElement, 'javaScriptUrls': allJavascriptUrls, 'policyUrls': allPolicyLinks, 'htmlUrl': window.location.href } };
				//if sending to consent gateway mention if website type is compliant or not
				if ($('meta[name=pisp]').attr('content') == 'Consent Gateway') {
					messageToSend = {
						'title': 'getContentsAndHash',
						'website_type': 'compliant',
						'data': {'info_for_receipt': info_for_receipt,'consentText': consentText, 'clickedElement': clickedElement, 'javaScriptUrls': allJavascriptUrls, 'policyUrls': allPolicyLinks, 'htmlUrl': window.location.href}
					};
				}
				// sending message to server to receipt server
				websocket.send(JSON.stringify(messageToSend));
			});

			websocket.addEventListener("message", message => {
				let message_data = JSON.parse(message.data);
				//When server completes hashing and send data back sign and send the personal data involved
				if (message_data.title == "hashingCompleted") {
					if (message_data.data.policyHash == policyHash && message_data.data.htmlHash == htmlHash && message_data.data.javascriptHash == javascriptCodeHash) {
						console.log(" All Hashes Match");
						receiptId = Generateuuidv4();
						console.log(`Receipt is id ${receiptId}`);
						let sendPII = { 'title': 'getSignedMessage', 'data': { PII }};
						websocket.send(JSON.stringify(sendPII));
						nounce = (1e9 * Math.random() * 1e9 * Math.random()).toString(16);
						let messagetoSign = { htmlContent: htmlContent, javascript: allJavascriptContent, policy: allPolicyContent, PII: PII, timestamp: timestamp, nounce: nounce,info_for_receipt:info_for_receipt};

						// sending message to background to sign the message
						sendMessageToBackground('signDetails', messagetoSign);
					}
					else {console.log("Hashes not Matching");}

				}
				if (message_data.title == "signedMessage" || message_data.title == "signedMessageFromConsentGateWay") {
					// If the signature is valid then
					if (verify_signed_message(message_data)) {
						console.log("Valid Signature from server");
						console.log('Downloading Receipt');
						let piicontrollers = (typeof (info_for_receipt.piicontrollers) != undefined) ? info_for_receipt.piicontrollers : 'null';
						let piiprincipal = (typeof (info_for_receipt.piiprincipal) != undefined) ? info_for_receipt.piiprincipal : 'null';
						let jurisdictions = (typeof (info_for_receipt.jurisdictions) != undefined) ? info_for_receipt.jurisdictions : 'null';
						let consent = (typeof (info_for_receipt.consent) != undefined) ? info_for_receipt.consent : 'null';
						let purposes = (typeof (info_for_receipt.purposes) != undefined) ? info_for_receipt.purposes : 'null';
						let language = (typeof (info_for_receipt.language) != undefined) ? info_for_receipt.language : navigator.language;
						let receipt_structure = {
							"identifier": receiptId,
							"version": "dev-3a",
							"timestamp": timestamp,
							"checksum": allHash,
							"language": language,
							"status": "issued",
							"piicontrollers": piicontrollers,
							"piiprincipal":piiprincipal,
							"jurisdictions":jurisdictions,
							"consent":consent,
							"purposes": purposes,
							"more_info":info_for_receipt
						}
						let paecgData = {
							'server_public_key': message_data.data.server_publickeypem,
							'signed_Messaged': message_data.data.signedMessage,
							'DataSigned': {
								htmlContent: htmlContent, javascript: allJavascriptContent,
								policy: allPolicyContent, PII: PII,
								timestamp: message_data.data.timestamp,
								nounce: message_data.data.nounce,
								info_for_receipt: info_for_receipt},
							htmlHash,javascriptCodeHash, policyHash,PIIHash,
							consentText,clickedElement
						};
						receipt_structure['paecg'] = paecgData;
						//Todo what to save to the cloud
						let cloudReceiptData = {
							receipt: JSON.stringify(receipt_structure),
							domain: window.location.host,
							created_date: timestamp,
							consentText: consentText,
							fullurl: window.location.href
						};
						//sendMessageToBackground("saveToCloud", cloudReceiptData)
						//downloading the file locally
						downloadReceipt(JSON.stringify(receipt_structure), `receipt_${receiptId}`);
					}
					else {console.log('Signature not valid From Server');}
				}
			});

			websocket.addEventListener("error", err => {
				console.log(err);
			});

		});
	});
}

/**  ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑  Complaint Websites  ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑ 
---------------------------------------------------------------------------------- 
↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓  Non Complaint Website  ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓ 
 */


/**
 * (For Non Complaint )
 * This function checks for the button click after generate receipt button is clicked popup html 
 */
function checkFirstClickOnButton() {
	let allButtons = document.body.querySelectorAll("input[type='button'], button");
	allButtons.forEach(element => {
		element.addEventListener('click', firstClickHandel, true);
	});
}


/**
 * For Non Compliant Website
 * This function removes all the previous event listner for buttons and calls function to generate receipt
 */

function firstClickHandel(event) {
	//Removing all Event Listner for all the buttons before generating receipt
	let allButtons = document.body.querySelectorAll("input[type='button']");
	allButtons.forEach(element => {
		element.removeEventListener('click', firstClickHandel, true);
	});
	generateReceiptForNonComplaint(event.target);
}

/**
 * For Non Compliant Website
 * Gets all the privacy policy links from the page
 * checks if the page a hyperlink has text policy or privacy
 */
async function getAllPrivacyPolicyUrls() {
	let allLinks = document.links;
	allPolicyLinks = [];
	for (let thislink of allLinks) {
		if (thislink.innerHTML.toString().toLowerCase().includes("policy") ||
			thislink.innerHTML.toString().toLowerCase().includes("privacy")) {
			allPolicyLinks.push(thislink.href);
		}
	}
	// Removing the duplicates links from the array
	allPolicyLinks = allPolicyLinks.filter(function (elem, index, self) {
		return index === self.indexOf(elem);
	});
}

/**
 * For Non Complaint Website
 * Gets all the input from the page.
 */
async function gatherAllPII() {
	PII = {};
	$("input").each(function () {
		var input = $(this);
		PII[input[0].id] = input[0].value;
	});
}

/**
 * Generates Receipt for Non complaint Website
 *  does following task :
 *  tries to get all js files
 *  tries to get all the policy url files
 *  gets content from all the gather js and policy files
 *  gathers all the inputs fields 
 *  gets the html of the page 
 *	hash them
 *	exchange messages with server(own) or consent gateway
 *  checks if the hashes are same (if yes) signs and send message to the server. 
 * 	checks if the signature sent by server is valid (if yes) generates the receipt
 * 	downloads the receipt
 * 
 */
function generateReceiptForNonComplaint(element) {
	//getting the value of the button clicked
	consentText = element.value;
	allJavascriptUrls = [];
	// Getting all src and innerhtml from all the script tags from the page
	Array.prototype.slice.call(document.scripts).forEach(element => {
		if (element.src != "") {
			allJavascriptUrls.push(element.src);
		}
	});

	//getting all the fields and then hashing them
	Promise.all([gatherJavascriptFiles(allJavascriptUrls), getAllPrivacyPolicyUrls(), gatherPolicyFiles(allPolicyLinks), gatherAllPII(), getHtml()]).then(() => {
		hashContents().then(() => {
			console.log("Hashing done by the client");

			//making connection to the consent gateway to generate receipt
			websocket = new WebSocket('ws://46.101.26.188');
			websocket.addEventListener("open", () => {
				console.log("Connection made with Consent Gateway server");
				//send information about the website to consent gateway
				let messageToSend = { 'title': 'getContentsAndHash', 'website_type': 'noncompliant', 'data': { 'htmlUrl': window.location.href, 'javaScriptUrls': allJavascriptUrls, 'policyUrls': allPolicyLinks } };
				// sending message to server to receipt server
				websocket.send(JSON.stringify(messageToSend));
			});
			websocket.addEventListener("message", message => {
				let message_data = JSON.parse(message.data);
				if (message_data.title == "hashingCompleted") {
					//check if hashes are matching with the hashes of the server
					if (message_data.data.policyHash == policyHash &&
						message_data.data.htmlHash == htmlHash &&
						message_data.data.javascriptHash == javascriptCodeHash) {
						console.log(" All Hashes Match");
						let sendPII = { 'title': 'getSignedMessage', 'data': { 'PII': PII } };
						websocket.send(JSON.stringify(sendPII));
						timestamp = new Date().getTime();
						nounce = (1e9 * Math.random() * 1e9 * Math.random()).toString(16);
						let messagetoSign = { htmlContent: htmlContent, javascript: allJavascriptContent, policy: allPolicyContent, PII: PII, timestamp: timestamp, nounce: nounce };

						// sending message to background to sign the message
						sendMessageToBackground('signDetails', messagetoSign);
					}
					else {
						console.log("Hashes not Matching");
					}
				}
				if (message_data.title == "signedMessageFromConsentGateWay") {
					if (verify_signed_message(message_data)) {
						console.log("Valid Signature from server");
						/**
						 * TODO: what will be in the receipt,, how to obtain information about the controller for non compliant websites
						 * 
						 * */
						let receipt_structure = {
							'identifier':receiptId
						}
						let paecgData = {
							'server_public_key': message_data.data.server_publickeypem,
							'signed_Messaged': message_data.data.signedMessage,
							'DataSigned': {
								htmlContent: htmlContent, javascript: allJavascriptContent,
								policy: allPolicyContent, PII: PII,
								timestamp: message_data.data.timestamp,
								nounce: message_data.data.nounce,
								info_for_receipt: info_for_receipt},
							htmlHash,javascriptCodeHash, policyHash,PIIHash,
							consentText,clickedElement
						};
						receipt_structure['paecg'] = paecgData;
						//Todo What to save in the cloud
						let cloudReceiptData = {
							receipt: JSON.stringify(receipt_structure),
							domain: window.location.host,
							created_date: timestamp,
							consentText: consentText,
							fullurl: window.location.href
						};
						sendMessageToBackground("saveToCloud", cloudReceiptData)

						//downloading the file locally
						console.log('Downloading Receipt');
						let fileName = `receipt${receiptId}.json`;
						downloadReceipt(JSON.stringify(receipt_structure), `${fileName}`);

					}
					else {
						console.log('Signature not valid From Server');
					}
				}

			});
			websocket.addEventListener("error", err => {
				console.log(err);
			});
		});
	});
}



/**
   ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑ Non Complaint Websites  ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑ 
  ----------------------------------------------------------------------------- 
  ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓  Event Listeners ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓ 
 */

/**
 *  If the Website Supports the protocol do the following
 */

if (supportsProtocol) {
	console.log("This Page is Supported by PaECG")
	pispUrl = $('meta[name=pisp]').attr('content');
	if (($("meta[name='lastPolicyUpdateDate']")).length > 0) {
		lastPolicyUpdateDate = $('meta[name=lastPolicyUpdateDate]').attr('content');
	}


	/* ↓↓↓↓↓↓↓↓↓↓↓↓↓↓   Using Semantics   ↓↓↓↓↓↓↓↓↓↓↓↓ */
	//getting all the consent submit buttons
	var allConsentElements = document.querySelectorAll('[data-type="consent-submit"]');

	// if there are elements then listen any click on those elements
	if (allConsentElements.length > 0) {
		allConsentElements.forEach(element => {
			element.addEventListener('click', handelClickOnComplaint);
		});
	}
	/**  ↑↑↑↑↑↑↑↑↑↑↑↑↑ Using Semantics ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑   */

}

/**
 * This is triggred when Page(PAECG.JS) sends message to the content script
 */
window.addEventListener("message", function (event) {
	if (event.source != window)
		return;
	if (event.data.type && (event.data.type == "FROM_PAGE")) {
		switch (event.data.title) {
			case "fetchConsentDetails":
				/**Get all Info */
				clickedElement = event.data.clicked_element;
				PII = event.data.PII;
				consentText = event.data.user_click_value;
				allJavascriptUrls = event.data.javascriptUrls;
				allPolicyLinks = event.data.policyUrls;
				consent_data = event.data.consent_data;
				info_for_receipt = event.data.info_for_receipt;
				/* Run the Protocol*/
				generateReceiptForCompliant();
		}
	}
});

/**
 * Listening Messages from Runtime
 */
chrome.runtime.onMessage.addListener(
	function (receivedMessage, sender, sendResponse) {
		let messageTitle = receivedMessage.title;
		if (messageTitle == "getCurrentPageInfo") {
			chrome.runtime.sendMessage({
				title: 'pageInfoResponse',
				data: { domain: window.location.host, fullUrl: window.location.href, isSupported: supportsProtocol, lastPolicyUpdateDate: lastPolicyUpdateDate }
			});
		}
		if (messageTitle == "checkSupported") {
			chrome.runtime.sendMessage({
				title: 'websiteSupportResponse',
				data: supportsProtocol
			});

		}
		if (messageTitle == "signedMessage") {
			//Todo: what to sign and send?
			website_type = isSupportedWebsite() ? 'complaint' : 'noncomplaint';
			let message_to_send_to_website = {
				'title': 'signedMessage',
				'website_type':website_type,
				'data': {
					public_key: receivedMessage.data.publickey_pem,
					signed_Data: receivedMessage.data.signedMessage,
					PII: PII,
					nounce,
					timestamp,receiptId
				}
			};
			console.log("Sending Signed Message to the website");
			websocket.send(JSON.stringify(message_to_send_to_website));
		}
		if (messageTitle == "generateReceipt") {
			//When generate Receipt is pressed in popup html For Non compliant website
			checkFirstClickOnButton();
		}
	});

