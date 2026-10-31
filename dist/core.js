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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromMetadata = exports.checkScript = void 0;
var check_1 = require("./functions/check");
Object.defineProperty(exports, "checkScript", { enumerable: true, get: function () { return check_1.checkScript; } });
var metadata_1 = require("./functions/metadata");
Object.defineProperty(exports, "fromMetadata", { enumerable: true, get: function () { return metadata_1.fromMetadata; } });
__exportStar(require("./structures/Formatter"), exports);
__exportStar(require("./structures/FunctionRegistry"), exports);
__exportStar(require("./structures/Linter"), exports);
__exportStar(require("./structures/Parser"), exports);
__exportStar(require("./types"), exports);
//# sourceMappingURL=core.js.map