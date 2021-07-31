class PaECG {
    constructor(setupDetails) {
        if (setupDetails == undefined && setupDetails == null && setupDetails.constructor != Object) {
            throw "PAECG expects `JSON` arugument Given " + setupDetails;
        }

        try {
            if (setupDetails.consent_submission_elements == undefined && setupDetails.consent_submission_elements == null && obj.constructor != Object) {
                throw "Expected `JSON` Given " + consent_submission_elements;
            }
            if (!Array.isArray(setupDetails.user_inputs)) {
                throw "Expected `Array` Given " + setupDetails.user_inputs;
            }
            if (!Array.isArray(setupDetails.javascript)) {
                throw "Expected `Array` Given " + setupDetails.javascript;
            }
            if (!Array.isArray(setupDetails.policyurl)) {
                throw "Expected `Array` Given " + setupDetails.policyurl;
            }
            if (!Array.isArray(setupDetails.thirdparties)) {
                throw "Expected `Array` Given " + setupDetails.policyurl;
            }


        this.consent_submission_elements = setupDetails.consent_submission_elements;
        this.user_inputs = setupDetails.user_inputs;
        this.javascript = setupDetails.javascript;
        this.policyurl = setupDetails.policyurl;
        this.thirdparties = setupDetails.thirdparties;
        this.all_receipt_data = [];

        if (setupDetails.all_receipt_data) {
                this.controller_details = setupDetails.all_receipt_data;

        }
            
        }
        catch (ex) {
            console.log(ex);
        }
    }

    setup() {
        for (let element in this.consent_submission_elements) {
            if (this.consent_submission_elements.hasOwnProperty(element)) {
                document.getElementById(element).addEventListener("click", ()=>this.runProtocol(element), true);
            }
        }
    }
    runProtocol(element) {
        var PII = {}
        for (var thisInput of this.user_inputs) {
            PII[thisInput] = document.getElementById(thisInput).value;
        }
        var user_click=this.consent_submission_elements[element];
	    var clicked_element=JSON.stringify(document.getElementById(element).outerHTML);
        window.postMessage({
            type: "FROM_PAGE",
            title: 'fetchConsentDetails',
            PII: PII,
	        clickedElement:clicked_element,
            user_click_value:user_click,
            thirdparties: this.thirdparties,
            javascriptUrls:this.javascript,
            policyUrls: this.policyurl,
            all_receipt_data:this.all_receipt_data
        }, "*");
            console.log('Sending click response ...');
    
    }

}