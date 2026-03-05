"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getAttomPropertyDetailsHttp = void 0;
const functions = __importStar(require("firebase-functions"));
const express_1 = __importDefault(require("express"));
const attomApiUtil_1 = require("./attomApiUtil");
const ATTOM_SECRET_NAME = 'projects/650294800122/secrets/ATTOM_API_KEY/versions/latest';
const allowedOrigins = ["http://localhost:5173", "https://app.allproperly.com", "https://allproperly.com"];
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    else {
        res.setHeader("Access-Control-Allow-Origin", allowedOrigins[0]);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers") || "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    // Handle preflight immediately
    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }
    next();
});
app.post('/getAttomPropertyDetails', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { address, city, state, zip } = req.body;
    // Basic validation for required fields
    if (!address || !city || !state || !zip) {
        return res.status(400).json({ error: 'Full address info is required' });
    }
    if (!/^\d{5}$/.test(zip)) {
        return res.status(400).json({ error: 'ZIP code must be 5 digits' });
    }
    try {
        const fullAddress = `${address}, ${city}, ${state} ${zip}`;
        const propertyDetails = yield (0, attomApiUtil_1.getAttomPropertyDetails)({ fullAddress }, ATTOM_SECRET_NAME);
        if (!propertyDetails || Object.keys(propertyDetails).length === 0) {
            return res.status(404).json({ error: 'No property found' });
        }
        return res.json(propertyDetails);
    }
    catch (error) {
        // Surface ATTOM's error response to frontend
        console.error('❌ ATTOM API error:', ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
        return res.status(500).json({
            error: ((_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message || 'Failed to fetch property details'
        });
    }
}));
exports.getAttomPropertyDetailsHttp = functions.https.onRequest(app);
