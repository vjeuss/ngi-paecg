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


function sendMessageToRuntime(title, data) {
	chrome.runtime.sendMessage({
		title: title,
		data: data
	});
}


var config_file;
sendMessageToRuntime('getConfigFile', '');
chrome.runtime.onMessage.addListener(
	function (receivedMessage, sender, sendResponse) {
		var msgdata = receivedMessage.data
		if (receivedMessage.title == "configFileResponse") {
			config_file = msgdata;
			document.getElementById('userId').value = msgdata.userId;
			document.getElementById('userToken').value = msgdata.userToken;
			document.getElementById('PrivateKey').innerText = msgdata.privateKey;
			document.getElementById('PublicKey').innerText = msgdata.publicKey;
		}
	});
document.getElementById('downloadConfig').addEventListener('click', () => downloadReceipt(JSON.stringify(config_file), 'config_file.json'), true);
$('#restoreConfig').hide();
$("#configUpload").change(function () {
	var fileName = $(this).val();
	$("#filename").html(fileName);
	let uploaded=event.target.files[0]
	console.log(uploaded);
	const reader = new FileReader;
	reader.onload = function () {
		try {
			let fileinjson = JSON.parse(reader.result);
			if (fileinjson.hasOwnProperty('userId') && fileinjson.hasOwnProperty('privateKey') && fileinjson.hasOwnProperty('publicKey') && fileinjson.hasOwnProperty('userToken')) {
				$('#restoreConfig').show();
				document.getElementById('userId').value = fileinjson.userId;
				document.getElementById('userToken').value = fileinjson.userToken;
				document.getElementById('PrivateKey').innerText = fileinjson.privateKey;
				document.getElementById('PublicKey').innerText = fileinjson.publicKey;
				$('#restoreConfig').on('click',function () {
					sendMessageToRuntime('restoreKeys', fileinjson);
					alert('Configuration Updated');
				});
			}
			else { 
				alert('Invalid File');
				}
		}
		catch (error) { 
			console.log(error);
		}

	}
	reader.readAsText(uploaded);
});






