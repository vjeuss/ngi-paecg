//Generating keypair 
var publicKey, privateKey, publicKey_pem, privateKey_pem, userId, userToken, currentActiveTab;
var rsa = forge.pki.rsa;
var keyPair = rsa.generateKeyPair({
    bits: 1024,
    e: 0x10001
});

//generate UUID for the Addon
function createUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
//Generate Token for the add on
function generateToken(n) {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var token = '';
    for (var i = 0; i < n; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
}

// When the tab is changed 
chrome.tabs.onActivated.addListener(function (changedTab) {
    console.log('active tab Id >> ', changedTab.tabId);
    currentActiveTab = changedTab.tabId;
    sendMessageToTab(changedTab.tabId, "checkSupported");
});


// when the Extension is Installed for the first time or when it is updated
chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install") {
        publicKey = keyPair.publicKey;
        privateKey = keyPair.privateKey
        publicKey_pem = forge.pki.publicKeyToPem(keyPair.publicKey);
        privateKey_pem = forge.pki.privateKeyToPem(keyPair.privateKey);
        userId = createUUID();
        userToken = generateToken(16);

        let config = {
            'userId': userId,
            'privateKey': privateKey_pem,
            'publicKey': publicKey_pem,
            'userToken': userToken,
        };
        saveToLocalStorage('config', config);
        chrome.tabs.create({
            url: "/popup/config.html"
        });
    } else if (details.reason == "update") {
        //Todo: call a function to handle an update
        console.log('update');
        chrome.storage.sync.get(['config'], function(result) {
            userId = result.config.userId;
            privateKey_pem = result.config.privateKey;
            publicKey_pem = result.config.publicKey;
            privateKey = forge.pki.privateKeyFromPem(privateKey_pem);
            userToken = result.config.userToken;
        });
    }
});


// Listening to messaged from Content Script
chrome.runtime.onMessage.addListener(
    function (receivedMessage, sender, sendResponse) {
        let messagetitle = receivedMessage.title;
        if (messagetitle == "websiteSupportResponse") {
            if (receivedMessage.data) {
                chrome.browserAction.setBadgeText({
                    text: "Supported"
                });
                chrome.browserAction.setBadgeBackgroundColor({
                    color: "green"
                });
            } else {
                chrome.browserAction.setBadgeBackgroundColor({
                    color: "red"
                });
                chrome.browserAction.setBadgeText({
                    text: "Not Supported"
                });
            }
            console.log('Color Changed');

        }
        if (messagetitle == "signDetails") {
            var rc = forge.md.sha256.create();
            let messageTosign = receivedMessage.data;

            console.log(messageTosign);
            rc.update(messageTosign, 'utf8');
            console.log("Signing the data >>")
            let sigedMessaged = privateKey.sign(rc);
            console.log("Data Signed by client side >> ")
            let data = {
                signedMessage: sigedMessaged,
                publickey_pem: publicKey_pem
            };
            sendMessageToTab(currentActiveTab, "signedMessage", data);
        }
        if (messagetitle == "getUserId_Token") {
            sendMessageToRuntime('UserId_TokenResponse', data = { userId: userId, userToken: userToken });
        }

        if (messagetitle == "saveToCloud") {
            saveReceiptToCloud(receivedMessage.data);
        }
        if (messagetitle == 'restoreKeys') {
            userId = receivedMessage.data.userId;
            privateKey_pem = receivedMessage.data.privateKey;
            publicKey_pem = receivedMessage.data.publicKey;
            privateKey = forge.pki.privateKeyFromPem(privateKey_pem);
            userToken = receivedMessage.data.userToken;


        }
        if (messagetitle == "getConfigFile") {
            let config_file = {
                'userId': userId,
                'privateKey': privateKey_pem,
                'publicKey': publicKey_pem,
                'userToken': userToken,
            };
            sendMessageToRuntime('configFileResponse', config_file);
        }
    }
);


/**
 * Send Message to Tab
 * @param  {Number} tabId
 * @param  {String} title=0
 * @param  {JSON} data=0
 */
function sendMessageToTab(tabId, title = 0, data = 0) {
    chrome.tabs.sendMessage(tabId, {
        title: title,
        data: data
    });
}

function sendMessageToRuntime(title, data = '') {
    chrome.runtime.sendMessage({
        title: title,
        data: data
    });
}

function saveReceiptToCloud(data) {
    data["userId"] = userId;
    data["userToken"] = userToken;

    $.post('http://3.10.208.186:1001/api/save', data)
        .done(function (msg) {
            if (msg.success) {
                console.log("Added To Cloud");
            }
            else {
                console.log("Failed to Save to the Cloud");
            }
        })
        .fail(function (xhr, status, error) {
            // error handling
            console.log("error");
            console.log(error);
        });
}


function saveToLocalStorage(keyname, data) {
    chrome.storage.sync.set({ [keyname]: data }, function () {
        if (chrome.runtime.lastError) {
            console.log("Error Could not save");
        }
    });
}