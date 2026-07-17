var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var API_URL = 'http://127.0.0.1:8000';
function fetchMountains() {
    return __awaiter(this, arguments, void 0, function (searchQuery) {
        var url, response, error_1;
        if (searchQuery === void 0) { searchQuery = ''; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    url = searchQuery ? "".concat(API_URL, "/get?search=").concat(encodeURIComponent(searchQuery)) : "".concat(API_URL, "/get");
                    return [4 /*yield*/, fetch(url)];
                case 1:
                    response = _a.sent();
                    if (!response.ok)
                        throw new Error('Network response was not ok');
                    return [4 /*yield*/, response.json()];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error fetching mountains:', error_1);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function renderMountains(mountains) {
    var grid = document.getElementById('trails-grid');
    if (!grid)
        return;
    grid.innerHTML = '';
    var _loop_1 = function (mountain) {
        var card = document.createElement('div');
        card.className = 'trail-card group relative bg-surface-container-lowest rounded-xl overflow-hidden border border-secondary/20 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer';
        card.innerHTML = "\n            <div class=\"h-64 overflow-hidden relative\">\n                <div class=\"trail-image w-full h-full bg-cover bg-center transition-transform duration-500\"\n                    style=\"background-image: url('".concat(mountain.image_url, "')\">\n                </div>\n            </div>\n            <div class=\"p-md flex flex-col gap-sm\">\n                <div class=\"flex justify-between items-start\">\n                    <div>\n                        <h3 class=\"font-headline-md text-headline-md text-primary\">").concat(mountain.name, "</h3>\n                        <p class=\"font-label-md text-label-md text-on-surface-variant\">").concat(mountain.location, "</p>\n                    </div>\n                    <a href=\"mountain_details.html?id=").concat(mountain.id, "\" class=\"material-symbols-outlined text-outline group-hover:text-primary transition-colors\">arrow_forward</a>\n                </div>\n                <div class=\"grid grid-cols-2 gap-base pt-2\">\n                    <div class=\"bg-surface-container-low p-sm rounded-lg\">\n                        <span class=\"block font-label-sm text-label-sm text-outline uppercase tracking-wider\">TOTAL HIKERS</span>\n                        <span class=\"font-headline-md text-headline-md text-primary\">").concat(mountain.total_hikers, "</span>\n                    </div>\n                    <div class=\"bg-surface-container-low p-sm rounded-lg\">\n                        <span class=\"block font-label-sm text-label-sm text-outline uppercase tracking-wider\">DIFFICULTY</span>\n                        <span class=\"font-headline-md text-headline-md text-secondary\">").concat(mountain.difficulty, "</span>\n                    </div>\n                </div>\n            </div>\n        ");
        card.addEventListener('mouseenter', function () { card.style.transform = 'translateY(-4px)'; });
        card.addEventListener('mouseleave', function () { card.style.transform = 'translateY(0)'; });
        card.addEventListener('mousedown', function () { card.style.transform = 'scale(0.98)'; });
        card.addEventListener('mouseup', function () { card.style.transform = 'translateY(-4px)'; });
        grid.appendChild(card);
    };
    for (var _i = 0, mountains_1 = mountains; _i < mountains_1.length; _i++) {
        var mountain = mountains_1[_i];
        _loop_1(mountain);
    }
}
function init() {
    return __awaiter(this, void 0, void 0, function () {
        var mountains, searchInput;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchMountains()];
                case 1:
                    mountains = _a.sent();
                    renderMountains(mountains);
                    searchInput = document.getElementById('search-input');
                    if (searchInput) {
                        searchInput.addEventListener('input', function (e) { return __awaiter(_this, void 0, void 0, function () {
                            var val, res;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        val = e.target.value;
                                        return [4 /*yield*/, fetchMountains(val)];
                                    case 1:
                                        res = _a.sent();
                                        renderMountains(res);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    }
                    return [2 /*return*/];
            }
        });
    });
}
document.addEventListener('DOMContentLoaded', init);
