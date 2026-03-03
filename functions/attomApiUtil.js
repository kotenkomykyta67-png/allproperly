"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttomApiKey = getAttomApiKey;
exports.getAttomPropertyDetails = getAttomPropertyDetails;
// @ts-ignore
const secret_manager_1 = require("@google-cloud/secret-manager");
const axios_1 = __importDefault(require("axios"));
const client = new secret_manager_1.SecretManagerServiceClient();
function getAttomApiKey(secretName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const [version] = yield client.accessSecretVersion({
            name: secretName,
        });
        const payload = (_b = (_a = version.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString();
        if (!payload)
            throw new Error('No secret payload found');
        return payload;
    });
}
function getAttomPropertyDetails(addressInfo, secretName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const apiKey = yield getAttomApiKey(secretName);
            // Helper to make request and log mode
            const tryRequest = (url, mode) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                console.log(`[ATTOM][DEBUG][${mode}] Using API Key:`, apiKey ? apiKey.slice(0, 6) + '...' : 'undefined');
                console.log(`[ATTOM][DEBUG][${mode}] Request URL:`, url);
                console.log(`[ATTOM][DEBUG][${mode}] Request Address Info:`, addressInfo);
                const response = yield axios_1.default.get(url, {
                    headers: {
                        apikey: apiKey,
                        Accept: 'application/json',
                    },
                });
                if ((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.property) === null || _b === void 0 ? void 0 : _b.length) {
                    console.log(`[ATTOM][${mode}] Success`, response.data.property[0]);
                    return response.data.property[0];
                }
                return null;
            });
            // Step 1: Try structured fields if available
            let property = null;
            if (addressInfo.street && addressInfo.city && addressInfo.state && addressInfo.zip) {
                const structuredUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?address1=${encodeURIComponent(addressInfo.street)}&city=${encodeURIComponent(addressInfo.city)}&state=${encodeURIComponent(addressInfo.state)}&postalcode=${encodeURIComponent(addressInfo.zip)}`;
                property = yield tryRequest(structuredUrl, 'STRUCTURED');
            }
            // Step 2: Fallback to full address if nothing found
            if (!property && addressInfo.fullAddress) {
                const fallbackUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?address=${encodeURIComponent(addressInfo.fullAddress)}`;
                property = yield tryRequest(fallbackUrl, 'FALLBACK');
            }
            if (!property) {
                console.error('[ATTOM][ERROR] No property found for given address');
                throw new Error('No property found for given address');
            }
            return property;
        }
        catch (error) {
            console.error('[ATTOM][ERROR]', error);
            throw error;
        }
    });
}
