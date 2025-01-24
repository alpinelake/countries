const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const state = {
    state: "", // playing, solved, done, open
    debug: urlParams.get('debug'),
    autoCenter: true,
    autoZoom: true,
    focusCountryCode: "",
    focusNeighbours: [],
    solved: new Set(),
    nonBordering: new Set(),
    enableSuggestions: false,
    multipleChoiceOptions: [],
    optionFocusIndex: -1,
    previousFocusCountry: "",

    setFocusCountry(code) {
        this.focusCountryCode = code;
        this.focusNeighbours = this.getNeighbours(code);
        this.autoCenter = true; // auto-center the next country
        this.autoZoom = true; // auto-zoom the next country
        this.nonBordering.clear(); // clear the non-bordering countries for the next round
        console.log(`setFocusCountry = ${code}`);
    },

    selectCountry(code) {
        if (!Neighbors.has(code.toUpperCase())) {
            console.log(`missing neighbor data for country: ${code}`);
            return;
        }
        if (this.focusNeighbours.includes(code)) {
            this.solved.add(code);
            this.multipleChoiceOptions = []; // clear options each time you get one right
        } else if (code != this.focusCountryCode && !this.solved.has(code)) {
            this.nonBordering.add(code);
        }

        let remaining = this.getRemaining();
        if (remaining.length == 0) {
            this.solved.add(this.focusCountryCode);
            this.previousFocusCountry = this.focusCountryCode;
            this.focusCountryCode = null;
            let candidate = this.candidateNextCountry();
            if (candidate) {
                this.state = "solved";
            } else {
                this.state = "done";
            }
        }
    },

    getNeighbours(override) {
        let result = [];
        let code = override || this.focusCountryCode;
        if (code) {
            let data = Neighbors.get(code.toUpperCase());
            if (data) {
                for (let i = 0; i < data.neighbour.length; i++) {
                    let code = data.neighbour[i].code.toLowerCase();
                    result.push(code);
                }
            }
        }
        return result;
    },

    getRemaining() {
        return this.focusNeighbours.filter(n => !this.solved.has(n));
    },

    candidateNextCountry() {
        // next country is one that's discovered and has undiscovered neighbors
        let solved = Array.from(this.solved);
        let next = null;
        for (let i = 0; i < solved.length; i++) {
            let code = solved[i];
            let neighbours = this.getNeighbours(code);
            if (neighbours.length > 0) {
                let unsolvedN = neighbours.filter(n => !solved.includes(n));
                if (unsolvedN.length > 0) { 
                    next = code;
                    break;
                }
            }
        }
        //TODO: Jump to a noncontiguous area if no undiscovered neighbours remain
        return next;
    }
};

function overlap(s1, s2, threshold) {
    let t = threshold;
    let bbox1 = s1.getBoundingClientRect();
    let bbox2 = s2.getBoundingClientRect();
    let none = (
        bbox1.top > bbox2.bottom-t ||
        bbox1.bottom < bbox2.top+t ||
        bbox1.left > bbox2.right-t ||
        bbox1.right < bbox2.left+t
    );
    return !none;
}

function overlappingLabels(code) {
    let label = document.querySelector(`.label.${code}`);
    let bbox = label.getBBox();
    let stack = state.getNeighbours(code).map(m => document.getElementById(m));
    let result = [];
    stack.forEach((neighbour) => {
        let ll = svg.querySelector(`.label.${neighbour.id}`);
        if (overlap(label, ll, 20)) {
            result.push(ll);
        }
    });
    return result;
}

function updateDom() {
    if (state.debug) document.body.classList.add("debug");
    else document.body.classList.remove("debug");

    let remaining = state.getRemaining();

    let focusedCountry = document.querySelector(".focusedCountry");
    let focusedLabel = document.querySelector(".focusedLabel");
    if (focusedCountry) focusedCountry.classList.remove("focusedCountry");
    if (focusedLabel) focusedLabel.classList.remove("focusedLabel");
    svg.querySelectorAll(".overlappingLabel").forEach(el => el.classList.remove("overlappingLabel"));

    if (state.previousFocusCountry) {
        let el = document.getElementById(state.previousFocusCountry);
        let label = svg.querySelector(`.label.${state.previousFocusCountry}`);
        label.innerHTML = label.dataset.name;
    }
    if (state.focusCountryCode) {
        let el = document.getElementById(state.focusCountryCode);
        el.classList.add("focusedCountry");
        let label = svg.querySelector(`.label.${state.focusCountryCode}`);
        label.innerHTML = `${label.dataset.name} (${remaining.length})`;
        label.classList.add("focusedLabel");
        label.classList.remove("hiddenLabel");

        svg.appendChild(label); // moves the label to the end so it's rendered on top

        // check for any overlapping labels
        let overlaps = overlappingLabels(state.focusCountryCode);
        overlaps.forEach(label => label.classList.add("overlappingLabel"));

        // display circle indicators for any neighbours that have them
        let previous = document.querySelectorAll(`.circlexx.hint`);
        previous.forEach(el => el.classList.remove("hint"));
        let neighbours = state.getNeighbours(state.focusCountryCode);
        neighbours.forEach((n) => {
            let circle = document.querySelector(`#${n} .circlexx`);
            if (circle) {
                circle.classList.add("hint");
            }
        });
        // focus country could have a circle too
        let elCircle = el.querySelector(".circlexx");
        if (elCircle) elCircle.classList.add("hint");
    }

    // non-bordering countries and labels
    Array.from(document.querySelectorAll(".nonBorderingCountry")).forEach(n => n.classList.remove("nonBorderingCountry"));
    Array.from(document.querySelectorAll(".nonBorderingLabel")).forEach((n) => {
        n.classList.remove("nonBorderingLabel");
        n.classList.add("hiddenLabel");
    });
    state.nonBordering.forEach((code) => {
        let n = document.getElementById(code);
        n.classList.add("nonBorderingCountry");
        let label = svg.querySelector(`.label.${code}`);
        label.classList.add("nonBorderingLabel");
        label.classList.remove("hiddenLabel");
    });

    // solved countries and labels
    Array.from(document.querySelectorAll(".solvedCountry")).forEach(n => n.classList.remove("solvedCountry"));
    state.solved.forEach((code) => {
        let n = document.getElementById(code);
        n.classList.add("solvedCountry");
        let label = svg.querySelector(`.label.${code}`);
        label.classList.add("solvedLabel");
        label.classList.remove("hiddenLabel");
    });

    let text = "";
    if (remaining.length > 0) {
        let name = document.getElementById(state.focusCountryCode).dataset.name;
        if (remaining.length == 1) {
            text = `${name} has ${remaining.length} undiscovered border country`;
        } else {
            text = `${name} has ${remaining.length} undiscovered border countries`;
        }
    }
    description.innerText = text;

    if (state.autoCenter) {
        centerFocused(state.autoZoom);
        state.autoCenter = false;
        state.autoZoom = false;
    }

    document.body.dataset.state = state.state;

    if (state.state == "playing") {
        userSearchInput.value = "";
    } else if (state.state == "solved") {
        countriesList.classList.remove("on");
        countriesList.classList.remove("choices");
        userSearchInput.value = "Solved! Click to Continue...";
    } else if (state.state == "done") {
        countriesList.classList.remove("on");
        countriesList.classList.remove("choices");
        userSearchInput.value = "Done";
    }
}

let isTouching = false;
let isDoubleTap = false;
let lastTapped = new Date().getTime();
let dx = 0, dy = 0;
let svg = document.querySelector("svg");

/* because touch events are bound to the document rather than svg (see related comment),
 * we add a click handler on the svg to have the browser refocus on the input element,
 * especially useful on mobile to avoid closing the keyboard, which is jarring
 */
svg.addEventListener("click", (e) => {
    userSearchInput.focus();
});

multipleChoiceButton.addEventListener("click", (e) => {
    userSearchInput.focus(); // refocus on input; avoids closing the keyboard

    let choices = [];
    if (countriesList.classList.toggle("choices")) {
        if (state.multipleChoiceOptions.length == 0) {
            // Filter sub territories from the options
            let options = Array.from(countriesList.querySelectorAll('[data-sub="false"]'));
            shuffle(options);
            let subset = options.slice(0, Math.min(3, options.length));

            let remaining = state.getRemaining();
            let i = Math.floor(Math.random() * remaining.length);
            let code = remaining[i];
            let answer = countriesList.querySelector(`[data-code=${code}][data-sub="false"]`);
            subset.push(answer)
            shuffle(subset);
            state.multipleChoiceOptions = subset;
        }
        choices = state.multipleChoiceOptions;
    }

    Array.from(countriesList.children).forEach((option) => {
        if (choices.includes(option)) {
            option.classList.remove("hidden");
        } else {
            option.classList.add("hidden");
        }
    });
});

function shuffle(array) {
    let currentIndex = array.length;
    while (currentIndex != 0) {
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
}

document.addEventListener("wheel", (e) => {
    // unless user is scrolling suggested options
    if (e.target.parentElement != countriesList) {
        const sign = Math.sign(e.deltaY);
        if (sign > 0) {
            // zoom out
            zoomDelta(svg.viewBox.baseVal.width*0.5, true);
        } else {
            // zoom in
            zoomDelta(-svg.viewBox.baseVal.width*0.25, true);
        }
    }
});

function updateOptionFocusIndex(index) {
    let focus = countriesList.querySelector(".focus");
    let options = Array.from(countriesList.querySelectorAll(":not(.hidden)"));
    if (focus) focus.classList.remove("focus");
    if (index >= 0 && index < options.length) {
        options[index].classList.add("focus");
        options[index].scrollIntoView({block:"center"});
        state.optionFocusIndex = index;
    }
}

window.addEventListener("keydown", (e) => {
    if (document.activeElement == userSearchInput) {
        let focus = countriesList.querySelector(".focus");
        let options = Array.from(countriesList.querySelectorAll(":not(.hidden)"));
        let index = state.optionFocusIndex;
        if (e.key === 'ArrowDown') {
            index = (index + 1) % options.length;
            updateOptionFocusIndex(index);
            countriesList.classList.add("on");
        } else if (e.key === 'ArrowUp') {
            if (index == -1) index = 0;
            index = (index - 1 + options.length) % options.length;
            updateOptionFocusIndex(index);
            countriesList.classList.add("on");
        } else if (e.key === 'Enter') {
            if (state.state == "playing") {
                if (index >= 0 && index < options.length) {
                    options[index].click();
                } else {
                    let title = userSearchInput.value.trim();
                    selectCountryByTitle(title);
                }
                updateOptionFocusIndex(-1);
            } else {
                userSearchInput.click();
            }
        }
    }
});

function getCoordinates(e) {
    let x, y;
    if (e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel') {
        let touch = e.touches[0];
        x = touch.pageX;
        y = touch.pageY;
    } else if (e.type == 'mousedown' || e.type == 'mouseup' || e.type == 'mousemove' || e.type == 'mouseover'|| e.type=='mouseout' || e.type=='mouseenter' || e.type=='mouseleave') {
        x = e.clientX;
        y = e.clientY;
    }
    return [x, y];
}

let touchdist1 = 0; // snapshot of distance between touch points when zooming starts
let point1 = null; // snapshot of svg coordinates of first touch
let coord1 = null; // snapshot of screen coordinates of first touch

/* touch events are bound to document rather than svg because this supports panning and
 * zooming _through_ the user input element as well as outside the bounds of the window,
 * this is very useful especially on mobile screens, e.g. dragging the touch behind the
 * open keyboard
 */
["mousedown", "touchstart"].forEach(t => document.addEventListener(t, (e) => {
    // ignore if clicking the input, selecting an option from the suggestions, etc.
    if (userSearch.contains(e.target)) return;
    countriesList.classList.remove("on");
    countriesList.classList.remove("choices");
    if (e.touches && e.touches.length == 2) {
        // 2 touches for zooming; record initial distance between touches
        touchdist1 = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY);
    } else {
        // 1 touch for dragging or double tapping to zoom
        let diff = (new Date().getTime()) - lastTapped;
        if (diff < 400 && diff > 0) {
            isDoubleTap = true;
        } else {
            lastTapped = new Date().getTime();
            isDoubleTap = false;
        }
        isTouching = true;
        coord1 = getCoordinates(e);
        let point = svg.createSVGPoint();
        point.x = coord1[0];
        point.y = coord1[1];
        // the cursor point, translated into svg coordinates
        point1 = point.matrixTransform(svg.getScreenCTM().inverse());
        dx = 0;
        dy = 0;
    }
}));

let minx1,miny1,width1,height1; // snapshot of viewbox parameters when zooming starts
let ratio = svg.getAttribute("height")/svg.getAttribute("width");

function zoomDelta(delta, override) {
    // use snapshot if available, so that zooming is relative to the touchstart viewBox,
    // fields are unset on the zoom action ending i.e. touchend
    if (!minx1 || override) [minx1,miny1,width1,height1] = svg.getAttribute("viewBox").split(" ").map(Number);

    let width2 = width1 + delta*2;
    if (width2 < 50) return; // don't zoom in further

    // if the entire svg fits in the height of the window then don't zoom out further
    let s0 = p0.matrixTransform(svg.getScreenCTM()); // screen coordinates
    let s2 = p2.matrixTransform(svg.getScreenCTM());
    if (s2.y - s0.y < window.innerHeight && delta > 0) return;
 
    let height2 = width2*ratio;
    let minx2 = minx1 - (width2-width1)/2;
    let miny2 = miny1 - (height2-height1)/2;

    svg.setAttribute("viewBox", `${minx2} ${miny2} ${width2} ${height2}`);

    box1.x.baseVal.value = minx2;
    box1.y.baseVal.value = miny2;
    box1.width.baseVal.value = width2;
    box1.height.baseVal.value = height2;
}

slider.addEventListener("input", (e) => {
    let delta = Number(e.target.value);
    zoomDelta(delta*2);
});

let p0 = svg.createSVGPoint(); // top left
let p1 = svg.createSVGPoint(); // top right
let p2 = svg.createSVGPoint(); // bottom left
p1.x = svg.getAttribute("width");
p2.y = svg.getAttribute("height");
let bufferX = window.innerWidth/3;
let bufferY = window.innerHeight/3;

["mousemove", "touchmove"].forEach(t => document.addEventListener(t, (e) => {
    e.preventDefault();
    if (e.touches && e.touches.length == 2) {
        // 2 touches for zooming
        let factor = 2;
        let touchdist2 = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY);
        zoomDelta((touchdist1-touchdist2)*factor);
    } else if (isTouching && isDoubleTap && coord1) {
        // 1 touch, double tap, drag for zoom
        let coord = getCoordinates(e); // screen coordinates in this case because svg is buggy
        let delta = coord1[1]-coord[1]; // distance in y direction from the first touch
        zoomDelta(delta);
    } else if (isTouching && point1) {
        // 1 touch for dragging
        let coord = getCoordinates(e); // screen coordinates in this case because svg is buggy
        let point2 = svg.createSVGPoint();
        point2.x = coord[0];
        point2.y = coord[1];
        point2 = point2.matrixTransform(svg.getScreenCTM().inverse());
        dx = point1.x - point2.x;
        dy = point1.y - point2.y;

        let s0 = p0.matrixTransform(svg.getScreenCTM()); // screen coordinates
        let s1 = p1.matrixTransform(svg.getScreenCTM());
        let s2 = p2.matrixTransform(svg.getScreenCTM());
        if ((s0.x-bufferX <= 0 && dx < 0) || (s1.x+bufferX >= window.innerWidth && dx > 0)) {
            // not hit the left edge and going left, or
            // not hit the right edge and going right
            svg.viewBox.baseVal.x += dx;
        }
        if ((s0.y-bufferY <= 0 && dy < 0) || (s2.y+bufferY >= window.innerHeight && dy > 0)) {
            // not hit the top edge and going down, or
            // not hit the bottom edge and going up
            svg.viewBox.baseVal.y += dy;
        }
    }
}));

function resetTouchState() {
    isTouching = false;
    point1 = null;

    // reset baseline viewbox parameters so the next zoom starts relative to the new viewbox
    [minx1,miny1,width1,height1] = [null,null,null,null];

    // don't allow negative height or width (this should be never happen given the constraints)
    if (svg.viewBox.baseVal.width < 0 || svg.viewBox.baseVal.height < 0) {
        userSearchInput.value = `Error: zoom reset`;
        svg.setAttribute("viewBox", `0 0 ${svg.getAttribute("width")} ${svg.getAttribute("height")}`);
    }
}

/*
["mouseleave", "touchcancel"].forEach(t => document.addEventListener(t, (e) => {
    // If the cursor leaves the document, end any pan or zoom action
    resetTouchState();
}));
*/

["mouseup", "touchend"].forEach(t => document.addEventListener(t, (e) => {
    resetTouchState();

    // Detect a click by checking for 0 drag in x, y directions;
    // not ideal because this is almost 0 in the local coordinate space
    // because the transform has already been applied(?)
    if (state.debug && dx == 0 && dy == 0 && e.target && e.target.closest) {
        let country = e.target.closest(".marked");
        if (country) {
            if (state.state == "playing" && state.debug) {
                state.selectCountry(country.id);
                updateDom();
            }
        }
    }
}));

function mainlandForCountry(country) {
    let code = country.id;
    let mainland = country.querySelector(`[id$="_mainland"]`) || country;
    if (code == "cl") {
        mainland = country.querySelector(`[id="path6470"]`);
    } else if (code == "ki") {
        mainland = country.querySelector(`[id="path4788"]`);
    } else if (code == "ru") {
        mainland = country.querySelector(`[id="path2924"]`);
    } else if (code == "us") {
        mainland = country.querySelector(`[id="United_States_lower_48"]`);
    }
    return mainland;
}

let firstZoom = true;

function centerFocused(zoom) {
    let country = svg.querySelector(".focusedCountry");
    if (!country) return;
    let bbox = mainlandForCountry(country).getBBox();
    let minx2, miny2, width2, height2;
    if (firstZoom || zoom) {
        firstZoom = false;
        // resize and center the viewBox on the country element
        let minx1 = bbox.x;
        let miny1 = bbox.y;
        let width1 = bbox.width;
        let height1 = bbox.height;
        width2 = Math.round(Math.min(Math.max(width1, 200), 400));
        height2 = Math.round(height1*ratio);
        minx2 = Math.round(minx1 - (width2-width1)/2);
        miny2 = Math.round(miny1 - (height2-height1)/2);
    } else {
        // center the viewBox on the country element, using the current screen size
        let screenw = Math.round(window.innerWidth / svg.getScreenCTM().a);
        let screenh = Math.round(window.innerHeight / svg.getScreenCTM().a);
        minx2 = Math.round(bbox.x - (screenw/2) + (bbox.width/2));
        miny2 = Math.round(bbox.y - (screenh/2) + (bbox.height/2));
        width2 = screenw;
        height2 = screenh;
    }

    svg.setAttribute("viewBox", `${minx2} ${miny2} ${width2} ${height2}`);

    // debugging
    box1.x.baseVal.value = svg.viewBox.baseVal.x;
    box1.y.baseVal.value = svg.viewBox.baseVal.y;
    box1.width.baseVal.value = svg.viewBox.baseVal.width;
    box1.height.baseVal.value = svg.viewBox.baseVal.height;
}

function filterInputOptions(query) {
    let queryTokens = [];
    if (query) {
        queryTokens = query.toLocaleLowerCase('en-US').replace(/[^a-zA-Z ]/g, "").trim().split(' ');
    }
    Array.from(countriesList.children).forEach((option) => {
        let normalized = option.dataset.value.toLocaleLowerCase('en-US');
        if (query && query.length == 1) {
            // display any options that begin with the character being searched
            if (normalized[0] == query[0].toLocaleLowerCase('en-US')) {
                option.classList.remove("hidden");
            } else {
                option.classList.add("hidden");
            }
        } else {
            // search the possible options
            let tokens = normalized.replace(/[^a-zA-Z ]/g, "").split(' ');
            // count each query token a match if it's a substring of any token
            let matches = queryTokens.filter(q => tokens.find(t => t.includes(q)));
            if (!query || query.length < 2 || matches.length == queryTokens.length) {
                // either query is not long enough or all query tokens match this item
                option.classList.remove("hidden");
            } else {
                option.classList.add("hidden");
            }
        }
    });
}

userSearchInput.addEventListener("input", (e) => {
    countriesList.classList.remove("choices");
    let focus = countriesList.querySelector(".focus");
    if (focus) focus.classList.remove("focus");
    state.optionFocusIndex = -1;
    let query = e.target.value;
    if (query) {
        countriesList.classList.add("on");
    } else {
        countriesList.classList.remove("on");
    }
    filterInputOptions(query);
});

userInputControls.addEventListener("click", (e) => {
    // clicking alongside (but outside) the countries list, so hide the list
    if (e.target == userInputControls) {
        countriesList.classList.remove("on");
        countriesList.classList.remove("choices");
    }
    // reset these just in case they failed to clear on mouseup touchend (bug?)
    resetTouchState();
});

userSearchInput.addEventListener("blur", (e) => {
    state.enableSuggestions = false;
});
userSearchInput.addEventListener("click", (e) => {
    if (state.state == "playing") {
        countriesList.classList.remove("choices"); // hide multiple choice if displayed
        filterInputOptions(userSearchInput.value); // reset previous filters if any
        if (state.enableSuggestions) {
            countriesList.classList.toggle("on");
            let focus = countriesList.querySelector(".focus");
            if (focus) focus.classList.remove("focus");
            state.optionFocusIndex = -1;
        }
        state.enableSuggestions = true;
    } else if (state.state == "solved") {
        let next = state.candidateNextCountry();
        if (next) {
            state.setFocusCountry(next);
            state.state = "playing";
        } else {
            state.state = "done";
        }
        updateDom();
    } else if (state.state == "done") {
        state.state = "open";
        updateDom();
    }
});

countriesList.addEventListener("mouseover", (e) => {
    updateOptionFocusIndex(-1);
});

function selectCountryByTitle(title) {
    if (!title) return;
    userSearchInput.value = "";
    countriesList.classList.remove("on");
    countriesList.classList.remove("choices");
    filterInputOptions(null);

    let el = svg.querySelector(`[data-title="${title}" i]`);
    if (el) {
        state.selectCountry(el.id);
        updateDom();
    } else {
        console.log(`Cannot find country ${title}`);
    }
}
function selectCountryByCode(code) {
    if (!code) return;
    userSearchInput.value = "";
    countriesList.classList.remove("on");
    countriesList.classList.remove("choices");
    filterInputOptions(null);
    state.selectCountry(code);
    updateDom();
}

function validate() {
    // check that every neighbor entry has an element on the map
    Neighbors.forEach((v,k) => {
        let code = k.toLowerCase();
        let el = document.getElementById(code);
        if (el) {
            let neighbours = v.neighbour;
            neighbours.forEach((n) => {
                let ncode = n.code.toLowerCase();
                let nel = document.getElementById(ncode);
                if (!nel) {
                    let option = document.querySelector(`option[data-code="${ncode}"]`);
                    let text = "";
                    if (option) {
                        option.remove();
                        text = "option removed";
                    } else {
                        text = "option not found to remove";
                    }
                    console.log(`Code ${ncode} referenced by ${code} but not found on the map, ${text}`);
                }
            });
        } else { 
            let option = document.querySelector(`option[data-code="${code}"]`);
            let text = "";
            if (option) {
                option.remove();
                text = "option removed";
            } else {
                text = "option not found to remove";
            }
            console.log(`Code ${code} listed in data but not found on the map, ${text}`);
        }
    });

    // check that every country on the map has neighbor data
    document.querySelectorAll(".marked").forEach(el => {
        let code = el.id;
        let data = Neighbors.get(code.toUpperCase());
        if (data) {
            let neighbours = data.neighbour;
            if (neighbours.length == 0) {
                //TODO: Incorporate islands into the game
                el.classList.add("island");
            }
        } else {
            console.log(`Code ${code} found on the map but no data found`);
        }
    });

    // check that every inputable country name is on the map
    Array.from(countriesList.children).forEach((option) => {
        let code = option.dataset.code.toLowerCase();
        let el = svg.getElementById(code);
        if (!el || !el.classList.contains("marked")) {
            console.log(`Removing option ${code}:${option.dataset.value} not found on the map`);
            option.remove();
        }
    });
}

function init() {
    let countriesListData = [];
    Array.from(svg.querySelectorAll('title')).forEach((title) => {
        let country = title.parentElement; // usually the parent group or path is the country
        let code = country.id;
        if (code && !Neighbors.has(code.toUpperCase())) {
            // in some cases it's part of a set of territories grouped together
            if (country.parentElement.nodeName == "g") {
                country = country.parentElement;
                code = country.id;
                if (code && !Neighbors.has(code.toUpperCase())) {
                    // in rare cases it's part of a second grouping
                    if (country.parentElement.nodeName == "g") {
                        country = country.parentElement;
                        code = country.id;
                    }
                }
            }
        }

        if (code) {
            let n = Neighbors.get(code.toUpperCase());
            if (n) {
                // use mainland for positioning the label
                let mainland = mainlandForCountry(country);
                let bb = mainland.getBBox(); // local svg coordinate system
                let x = bb.x + (bb.width/2); // center the label
                let y = bb.y + (bb.height/2);
                let anchor = "middle";
                let name = title.innerHTML.split(", ")[0];
                let label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.className.baseVal = `hiddenLabel label ${code}`;
                label.setAttribute("x", x);
                label.setAttribute("y", y);
                label.setAttribute("text-anchor", anchor);
                label.innerHTML = name;
                label.dataset.name = label.innerHTML;
                let existing = countriesListData.find(d => d[0] == code);
                if (existing) {
                    if (title.parentElement.classList.contains("limitxx") ||
                        title.parentElement.querySelector(".limitxx")) {
                        // these are countries of limited diplomatic recognition,
                        // displayed on the map but not included in the options
                        console.log("Duplicate label", existing, title.innerHTML);
                    } else {
                        // these are sub territories grouped under a country,
                        // but included in the list so the user can select them
                        countriesListData.push([code, title.innerHTML, true]);
                    }
                } else {
                    countriesListData.push([code, title.innerHTML, false]);
                    svg.appendChild(label);
                }
                if (!country.classList.contains("marked")) {
                    country.classList.add("marked");
                    country.dataset.title = title.innerHTML;
                    country.dataset.name = name;
                }
            } else {
                console.log(`Cannot find neighbor data for country: ${code}`);
            }
        } else {
            console.log(`Cannot find map element for title: ${title.innerHTML}`);
        }
    });

    countriesListData.sort(function(a,b) {
        return a[1].localeCompare(b[1]); // sort by second field (name)
    });

    countriesListData.forEach((record) => {
        let option = document.createElement("div");
        option.dataset.code = record[0];
        option.dataset.value = record[1];
        option.dataset.sub = record[2];
        option.innerText = record[1];
        option.addEventListener("click", (e) => {
            userSearchInput.focus(); // refocus on input, avoid closing the keyboard
            //selectCountryByTitle(option.dataset.value);
            selectCountryByCode(option.dataset.code);
            updateOptionFocusIndex(-1);
        });
        countriesList.appendChild(option);
    });

}

function start() {
    let starting = urlParams.get('start');
    if (starting && !document.getElementById(starting)) {
        console.log(`Cannot find ${starting} on the map, choosing random country instead`);
        starting = null;
    }
    if (!starting) {
        //TODO: Incorporate islands into the game
        let unselected = svg.querySelectorAll(".marked:not(.solvedCountry):not(.island)");
        if (unselected.length) {
            let i = Math.floor(Math.random() * unselected.length);
            starting = unselected[i].id;
        }
    }
    if (starting) {
        state.state = "playing";
        state.setFocusCountry(starting);
        userSearchInput.value = "";
        userSearchInput.focus();
        updateDom();
    }
}

init();
validate();
start();
svg.classList.toggle("on"); // avoids a screen flash from loading the svg and setting the viewBox

