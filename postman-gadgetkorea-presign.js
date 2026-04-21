// Postman Pre-request Script for Gadget Korea API
// Set these in Postman environment variables: gadgetKorea_accessKey, gadgetKorea_secretKey

var method = pm.request.method;
var url = require('url');
var parsed = url.parse(pm.request.url.toString());
var pathAndQuery = parsed.path;

var timestamp = new Date().valueOf();
var accessKey = pm.environment.get("gadgetKorea_accessKey");
var secretKey = pm.environment.get("gadgetKorea_secretKey");

var stringToSign = `${method} ${pathAndQuery}\n${timestamp}\n${accessKey}`;
var base64Key = CryptoJS.enc.Base64.parse(secretKey);
var hashedString = CryptoJS.enc.Utf8.parse(stringToSign);
var hash = CryptoJS.HmacSHA256(hashedString, base64Key);
var signature = hash.toString(CryptoJS.enc.Base64);

pm.request.headers.add({ key: "x-gat-timestamp", value: String(timestamp) });
pm.request.headers.add({ key: "x-gat-access-key", value: accessKey });
pm.request.headers.add({ key: "x-gat-signature", value: signature });

console.log("timestamp:", timestamp);
console.log("signature:", signature);
