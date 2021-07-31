const express = require('express');
const bodyParser = require('body-parser');
const forge = require('node-forge');
const cors = require('cors')
const fetch = require("node-fetch");
const sha256= require("sha256");
const WebSocket = require('ws');
const date = require('date-and-time');
const wss = new WebSocket.Server({
    port: 3100
});
var htmlHash,javascriptHash,policyHash;
var allPolicyContent='';
var allJavascriptContent='';
var htmlContent=''
var consentText='';
var htmlUrl,javascriptUrls,policyUrls,info_for_receipt;

var fs = require('fs');
const {
    Console
} = require('console');
const rsa = forge.pki.rsa;
const keyPair = rsa.generateKeyPair({
    bits: 1024,
    e: 0x10001
});
const publicKey = keyPair.publicKey;
const privateKey = keyPair.privateKey
const publicKey_pem = forge.pki.publicKeyToPem(keyPair.publicKey);
const privateKey_pem = forge.pki.privateKeyToPem(keyPair.privateKey);


wss.on("connection", ws  => {
    console.log("New connection from client");
    ws.on("message",data=>{
        let message=JSON.parse(data);
        let message_data=message.data;
        console.log("Message title from client ->",message.title)
        if(message.title=="getContentsAndHash"){
        consentText=message_data.consentText;
		javascriptUrls=message_data.javaScriptUrls;
		policyUrls=message_data.policyUrls;
        htmlUrl = message_data.htmlUrl;
        info_for_receipt=message_data.info_for_receipt;
		console.log("Gathering Files...");
		Promise.all([gatherPolicyFiles(), gatherJavascriptFiles(),getHtml()]).then(() => {
		console.log("Files Gathered....");
		console.log("Hashing Files....");
        generateHash().then(() => {
                console.log({htmlHash,javascriptHash,policyHash});
                console.log("Hashing done.....");
                let messageTosend={"title":'hashingCompleted','data':{"javascriptHash":javascriptHash,"policyHash":policyHash,"htmlHash":htmlHash}}
                    ws.send(JSON.stringify(messageTosend));
            });
            });
        }
        if (message.title == "signedMessage") {
            console.log(message.data);
            let user_public_key = forge.pki.publicKeyFromPem(message_data.public_key);
            let user_signed_message = message_data.signed_Data;
	            let consent_details={
                htmlContent:htmlContent,javascript: allJavascriptContent,policy: allPolicyContent,PII: message_data.PII,timestamp:message_data.timestamp,nounce:message_data.nounce,info_for_receipt
            };
            console.log("Signed Message From Client");
            let messageDigest = forge.md.sha256.create();
            messageDigest.update(consent_details, 'utf8');
            let verify = user_public_key.verify(messageDigest.digest().bytes(), user_signed_message);
            // If the signature is valid then
            if (verify) {
                console.log("Signature is Valid");

                let receiptData = {
                    'identifier': message_data.receiptId,
                };

                receiptData['paecg']={
                    'user_public_key':message_data.public_key,
                    'signed_Messaged': message_data.signed_Data,
                    'DataSigned':consent_details,
                    'PII':message_data.PII,
                    'html':htmlContent,
                    'javascript':allJavascriptContent,
                    'policy':allPolicyContent,
                    htmlHash,javascriptHash,policyHash
                }
                let fileName=`receipts/receipt${message_data.receiptId}.json`;
                fs.writeFileSync(fileName, JSON.stringify(receiptData));
                console.log("Receipt Downloaded successfully.....");
        }
        else{
            console.log('Signature not valid from client');
        }


        
        }
        if(message.title=='getSignedMessage'){
            let timestamp=new Date().getTime();
            let nounce=( 1e9*Math.random()*1e9*Math.random() ).toString(16);
            let consent_details={
                htmlContent:htmlContent,javascript: allJavascriptContent,policy: allPolicyContent,PII: message_data.PII,timestamp:timestamp,nounce:nounce,info_for_receipt:info_for_receipt
            };


            let rc = forge.md.sha256.create();
            rc.update(consent_details, 'utf8');
            let sigedMessaged = privateKey.sign(rc);
            console.log("Data Signed By the Server")
            let data = {
                signedMessage: sigedMessaged,
                server_publickeypem: publicKey_pem,
                timestamp:timestamp,
                nounce:nounce
            };
            console.log("Sending Signed Data To the Client");
            ws.send(JSON.stringify({'title':'signedMessage','data':data}));

        }


    });

    ws.on("close", () => {
        console.log("Connection Closed with the client");
    });
    
});

async function getHtml(){
    htmlContent=await getContentFromUrl(htmlUrl);
}

async function gatherJavascriptFiles() {
    allJavascriptContent='';
	for (let javascripturl of javascriptUrls) {
        let javasciptcode = await getContentFromUrl(javascripturl);
        allJavascriptContent += javasciptcode;
	}
}

async function gatherPolicyFiles() {
    allPolicyContent='';
	for (let policyUrl of policyUrls) {
        let policyUrlContent = await getContentFromUrl(policyUrl);
        allPolicyContent += policyUrlContent;
	}
}

async function generateHash(){
    htmlHash=await sha256(htmlContent);
    policyHash=await sha256(allPolicyContent);
    javascriptHash=await sha256(allJavascriptContent);
    
}

async function getContentFromUrl(file) {
	var res = await fetch(file);
	res = await res.text();
	return res.toString(16);
}
