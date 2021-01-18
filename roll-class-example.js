/**
 * This class provides an interface and API for conducting dice rolls.
 * The basic structure for a dice roll is a string formula and an object of data against which to parse it.
 *
 * @param formula {String}    The string formula to parse
 * @param data {Object}       The data object against which to parse attributes within the formula
 *
 * @see {@link Die}
 * @see {@link DicePool}
 *
 * @example
 * // Attack with advantage!
 * let r = new Roll("2d20kh + @prof + @strMod", {prof: 2, strMod: 4});
 *
 * // The parsed terms of the roll formula
 * console.log(r.terms);    // [Die, +, 2, +, 4]
 *
 * // Execute the roll
 * r.evaluate();
 *
 * // The resulting equation after it was rolled
 * console.log(r.result);   // 16 + 2 + 4
 *
 * // The total resulting from the roll
 * console.log(r.total);    // 22
 */
class Roll {
   constructor(formula, data={}) {
 
     /**
      * The original provided data
      * @type {Object}
      */
     this.data = this._prepareData(data);
 
     /**
      * An array of inner terms which were rolled parenthetically
      * @type {DiceTerm[]}
      */
     this._dice = [];
 
     /**
      * The evaluated results of the Roll
      * @type {Array<number|string>}
      */
     this.results = [];
 
     /**
      * The identified terms of the Roll
      * @type {Array<Roll|DicePool|DiceTerm|number|string>}
      */
     this.terms = this._identifyTerms(formula, {step: 0});
 
     /**
      * The original formula before evaluation
      * @type {string}
      */
     this._formula = this.constructor.cleanFormula(this.terms);
 
     /**
      * An internal flag for whether the Roll object has been rolled
      * @type {boolean}
      * @private
      */
     this._rolled = false;
 
     /**
      * Cache the evaluated total to avoid re-evaluating it
      * @type {number|null}
      * @private
      */
     this._total = null;
   }
 
   /* -------------------------------------------- */
 
   /**
    * A factory method which constructs a Roll instance using the default configured Roll class.
    * @param {any[]} args      Arguments passed to the Roll instance constructor
    * @return {Roll}           The constructed Roll instance
    */
   static create(...args) {
     const cls = CONFIG.Dice.rolls[0];
     return new cls(...args);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Replace referenced data attributes in the roll formula with values from the provided data.
    * Data references in the formula use the @attr syntax and would reference the corresponding attr key.
    *
    * @param {string} formula          The original formula within which to replace
    * @param {object} data             The data object which provides replacements
    * @param {string} [missing]        The value that should be assigned to any unmatched keys.
    *                                  If null, the unmatched key is left as-is.
    * @param {boolean} [warn]          Display a warning notification when encountering an un-matched key.
    * @static
    */
   static replaceFormulaData(formula, data, {missing, warn=false}={}) {
     let dataRgx = new RegExp(/@([a-z.0-9_\-]+)/gi);
     return formula.replace(dataRgx, (match, term) => {
       let value = getProperty(data, term);
       if ( value === undefined ) {
         if ( warn ) ui.notifications.warn(game.i18n.format("DICE.WarnMissingData", {match}));
         return (missing !== undefined) ? String(missing) : match;
       }
       return String(value).trim();
     });
   }
 
   /* -------------------------------------------- */
 
   /**
    * Return an Array of the individual DiceTerm instances contained within this Roll.
    * @return {DiceTerm[]}
    */
   get dice() {
     return this._dice.concat(this.terms.reduce((dice, t) => {
       if ( t instanceof DiceTerm ) dice.push(t);
       else if ( t instanceof DicePool ) dice = dice.concat(t.dice);
       return dice;
     }, []));
   }
 
   /* -------------------------------------------- */
 
   /**
    * Return a standardized representation for the displayed formula associated with this Roll.
    * @return {string}
    */
   get formula() {
     return this.constructor.cleanFormula(this.terms);
   }
 
   /* -------------------------------------------- */
 
   /**
    * The resulting arithmetic expression after rolls have been evaluated
    * @return {string|null}
    */
   get result() {
     if ( !this._rolled ) return null;
     return this.results.join(" ");
   }
 
   /* -------------------------------------------- */
 
   /**
    * Return the total result of the Roll expression if it has been evaluated, otherwise null
    * @type {number|null}
    */
   get total() {
     if ( !this._rolled ) return null;
     return this._total;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Alter the Roll expression by adding or multiplying the number of dice which are rolled
    * @param {number} multiply   A factor to multiply. Dice are multiplied before any additions.
    * @param {number} add        A number of dice to add. Dice are added after multiplication.
    * @param {boolean} [multiplyNumeric]  Apply multiplication factor to numeric scalar terms
    * @return {Roll}             The altered Roll expression
    */
   alter(multiply, add, {multiplyNumeric=false}={}) {
     if ( this._rolled ) throw new Error("You may not alter a Roll which has already been rolled");
     this.terms = this.terms.map(t => {
       if ( t.alter ) return t.alter(multiply, add, {multiplyNumeric});
       else if ( (typeof t === "number") && multiplyNumeric ) return Math.round(t * multiply);
       return t;
     });
 
     // Update the altered formula and return the altered Roll
     this._formula = this.formula;
     return this;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Execute the Roll, replacing dice and evaluating the total result
    *
    * @param {boolean} [minimize]    Produce the minimum possible result from the Roll instead of a random result.
    * @param {boolean} [maximize]    Produce the maximum possible result from the Roll instead of a random result.
    *
    * @returns {Roll}    The rolled Roll object, able to be chained into other methods
    *
    * @example
    * let r = new Roll("2d6 + 4 + 1d4");
    * r.evaluate();
    * console.log(r.result); // 5 + 4 + 2
    * console.log(r.total);  // 11
    */
   evaluate({minimize=false, maximize=false}={}) {
     if ( this._rolled ) throw new Error("This Roll object has already been rolled.");
 
     // Step 1 - evaluate any inner Rolls and recompile the formula
     let hasInner = false;
     this.terms = this.terms.map((t, i, terms) => {
       if ( t instanceof Roll ) {
         hasInner = true;
         t.evaluate({minimize, maximize});
         this._dice = this._dice.concat(t.dice);
         const priorMath = (i > 0) && (terms[i-1].split(" ").pop() in Math);
         return priorMath ? `(${t.total})` : String(t.total);
       }
       return t;
     });
 
     // Step 2 - re-compile the formula and re-identify terms
     const formula = this.constructor.cleanFormula(this.terms);
     this.terms = this._identifyTerms(formula, {step: 1});
 
     // Step 3 - evaluate remaining terms
     this.results = this.terms.map(term => {
       if ( term.evaluate ) return term.evaluate({minimize, maximize}).total;
       else return term;
     });
 
     // Step 4 - safely evaluate the final total
     let total = this._safeEval(this.results.join(" "));
     if ( total === null ) total = 0;
     if ( !Number.isNumeric(total) ) {
       throw new Error(game.i18n.format("DICE.ErrorNonNumeric", {formula: this.formula}));
     }
 
     // Store final outputs
     this._total = total;
     this._rolled = true;
     return this;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Clone the Roll instance, returning a new Roll instance that has not yet been evaluated
    * @return {Roll}
    */
   clone() {
     return new this.constructor(this._formula, this.data);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Evaluate and return the Roll expression.
    * This function simply calls the evaluate() method but is maintained for backwards compatibility.
    * @return {Roll}   The Roll instance, containing evaluated results and the rolled total.
    */
   roll() {
     return this.evaluate();
   }
 
   /* -------------------------------------------- */
 
   /**
    * Create a new Roll object using the original provided formula and data
    * Each roll is immutable, so this method returns a new Roll instance using the same data.
    *
    * @return {Roll}    A new Roll object, rolled using the same formula and data
    */
   reroll() {
     let r = new this.constructor(this.formula, this.data);
     return r.roll();
   }
 
   /* -------------------------------------------- */
 
   /**
    * Simulate a roll and evaluate the distribution of returned results
    * @param {string} formula    The Roll expression to simulate
    * @param {number} n          The number of simulations
    * @return {number[]}         The rolled totals
    */
   static simulate(formula, n=10000) {
     const results = [...Array(n)].map(i => {
       let r = new this(formula);
       return r.evaluate().total;
     }, []);
     const summary = results.reduce((sum, v) => {
       sum.total = sum.total + v;
       if ( (sum.min === null) || (v < sum.min) ) sum.min = v;
       if ( (sum.max === null) || (v > sum.max) ) sum.max = v;
       return sum;
     }, {total: 0, min: null, max: null});
     summary.mean = summary.total / n;
     console.log(`Formula: ${formula} | Iterations: ${n} | Mean: ${summary.mean} | Min: ${summary.min} | Max: ${summary.max}`);
     return results;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Validate that a provided roll formula can represent a valid
    * @param {string} formula    A candidate formula to validate
    * @return {boolean}          Is the provided input a valid dice formula?
    */
   static validate(formula) {
 
     // Replace all data references with an arbitrary number
     formula = formula.replace(/@([a-z.0-9_\-]+)/gi, "1");
 
     // Attempt to evaluate the roll
     try {
       const r = new this(formula);
       r.evaluate();
       return true;
     }
 
     // If we weren't able to evaluate, the formula is invalid
     catch(err) {
       return false;
     }
   }
 
   /* -------------------------------------------- */
   /*  Internal Helper Functions                   */
   /* -------------------------------------------- */
 
   /**
    * Create a formula string from an array of Dice terms.
    * @return {string}
    */
   static cleanFormula(terms) {
     terms = this.cleanTerms(terms).map(t => {
       if ( t instanceof Roll ) return `(${t.formula})`;
       return t.formula || String(t);
     }).join("");
     let formula = terms.replace(/ /g, "");
     return formula.replace(new RegExp(this.ARITHMETIC.map(o => "\\"+o).join("|"), "g"), " $& ");
   }
 
   /* -------------------------------------------- */
 
   /**
    * Clean the terms of a Roll equation, removing empty space and de-duping arithmetic operators
    * @param {Array<DiceTerm|string|number>} terms  The input array of terms
    * @return {Array<DiceTerm|string|number>}       The cleaned array of terms
    */
   static cleanTerms(terms) {
     return terms.reduce((cleaned, t, i, terms) => {
       if ( typeof t === "string" ) t = t.trim();
       if ( t === "" ) return cleaned;
       let prior = terms[i-1];
 
       // De-dupe addition and multiplication
       if ( ["+", "*"].includes(t) && prior === t ) return cleaned;
 
       // Negate double subtraction
       if ( (t === "-") && (prior === "-" ) ) {
         cleaned[i-1] = "+";
         return cleaned;
       }
 
       // Negate double division
       if ( (t === "/") && (prior === "/") ) {
         cleaned[i-1] = "*";
         return cleaned;
       }
 
       // Subtraction and negative values
       if ( ["-+", "+-"].includes(t+prior) ) {
         cleaned[i-1] = "-";
         return cleaned;
       }
 
       // Return the clean array
       cleaned.push(t);
       return cleaned;
     }, []);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Split a provided Roll formula to identify it's component terms.
    * Some terms are very granular, like a Number of an arithmetic operator
    * Other terms are very coarse like an entire inner Roll from a parenthetical expression.
    * As a general rule, this function should return an Array of terms which are ready to be evaluated immediately.
    * Some terms may require recursive evaluation.
    * @private
    *
    * @param {string} formula  The formula to parse
    * @param {number} [step]   The numbered step in the Roll evaluation process.
    * @return {Array<Roll|DicePool|DiceTerm|number|string>}       An array of identified terms
    */
   _identifyTerms(formula, {step=0}={}) {
     if ( typeof formula !== "string" ) throw new Error("The formula provided to a Roll instance must be a string");
 
     // Step 1 - Update the Roll formula using provided data
     formula = this.constructor.replaceFormulaData(formula, this.data, {missing: "0", warn: true});
 
     // Step 2 - identify separate parenthetical terms
     let terms = this._splitParentheticalTerms(formula);
 
     // Step 3 - expand pooled terms
     terms = this._splitPooledTerms(terms);
 
     // Step 4 - expand remaining arithmetic terms
     terms = this._splitDiceTerms(terms, step);
 
     // Step 5 - clean and de-dupe terms
     terms = this.constructor.cleanTerms(terms);
     return terms;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Prepare the data structure used for the Roll.
    * This is factored out to allow for custom Roll classes to do special data preparation using provided input.
    * @param {object} data   Provided roll data
    * @private
    */
   _prepareData(data) {
     return data;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Identify and split a formula into separate terms by arithmetic terms
    * @private
    */
   _splitDiceTerms(terms, step) {
 
     // Split on arithmetic terms and operators
     const operators = this.constructor.ARITHMETIC.concat(["(", ")"]);
     const arith = new RegExp(operators.map(o => "\\"+o).join("|"), "g");
 
     // Expand remaining string terms by splitting on arithmetic operators
     terms = terms.reduce((arr, term) => {
       if ( typeof term === "string" ) {
         const split = term.replace(arith, ";$&;").split(";");
         for ( let s of split ) {
           s = s.trim();
           if ( s !== "" ) arr.push(s);
         }
       }
       else arr.push(term);
       return arr;
     }, []);
 
     // Iterate over all terms, identifying numeric and dice terms
     terms = terms.reduce((arr, term, i, terms) => {
 
       // Preserve existing object types
       if ( getType(term) === "Object" ) {
         arr.push(term);
         return arr;
       }
 
       // Handle arithmetic terms
       if ( this.constructor.ARITHMETIC.includes(term) ) {
         if ( !arr.length && (term !== "-") ) return arr; // Ignore leading arithmetic except negatives
         else if ( i === (terms.length - 1) ) return arr; // Ignore trailing arithmetic
         arr.push(term);
         return arr;
       }
 
       // Handle numeric terms
       if ( Number.isNumeric(term) ) {
         arr.push(Number(term));
         return arr;
       }
 
       // Identify Dice terms
       if ( DiceTerm.matchTerm(term, {imputeNumber: step > 0}) ) {
         const die = DiceTerm.fromExpression(term);
         arr.push(die);
         return arr;
       }
 
       // Remaining string terms
       arr.push(term);
       return arr;
     }, []);
 
     // Return the set of final terms
     return terms;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Identify and split a formula into separate terms by parenthetical expressions
    * @private
    */
   _splitParentheticalTerms(formula) {
 
     // Augment parentheses with semicolons and split into terms
     const split = formula.replace(/\(/g, ";(;").replace(/\)/g, ";);");
 
     // Match outer-parenthetical groups
     let nOpen = 0;
     const terms = split.split(";").reduce((arr, t, i, terms) => {
       if ( t === "" ) return arr;
 
       // Identify whether the left-parentheses opens a math function
       let mathFn = false;
       if ( t === "(" ) {
         const fn = terms[i-1].match(/(?:\s)?([A-z0-9]+)$/);
         mathFn = fn && !!Roll.MATH_PROXY[fn[1]];
       }
 
       // Combine terms using open parentheses and math expressions
       if ( (nOpen > 0) || mathFn ) arr[arr.length - 1] += t;
       else arr.push(t);
 
       // Increment the count
       if ( (t === "(") ) nOpen++;
       else if ( (t === ")") && ( nOpen > 0 ) ) nOpen--;
       return arr;
     }, []);
 
     // Close any un-closed parentheses
     for ( let i=0; i<nOpen; i++ ) terms[terms.length - 1] += ")";
 
     // Substitute parenthetical dice rolls groups to inner Roll objects
     return terms.reduce((terms, term) => {
       const prior = terms.length ? terms[terms.length-1] : null;
       if ( term[0] === "(" ) {
 
         // Handle inner Roll parenthetical groups
         if ( /[dD]/.test(term) ) {
           terms.push(Roll.fromTerm(term, this.data));
           return terms;
         }
 
         // Evaluate arithmetic-only parenthetical groups
         term = this._safeEval(term);
         term = Number.isInteger(term) ? term : term.toFixed(2);
 
         // Continue wrapping math functions
         const priorMath = prior && (prior.split(" ").pop() in Math);
         if ( priorMath ) term = `(${term})`;
       }
 
       // Append terms to to non-Rolls
       if ((prior !== null) && !(prior instanceof Roll)) terms[terms.length-1] += term;
       else terms.push(term);
       return terms;
     }, []);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Identify and split a formula into separate terms by curly braces which represent pooled expressions
    * @private
    */
   _splitPooledTerms(terms) {
 
     // First re-organize the terms by splitting on curly braces
     let nOpen = 0;
     terms = terms.reduce((terms, term) => {
 
       // Force immediate processing of inner objects which are encountered within an open outer pool
       if ( (term instanceof Roll) || (term instanceof DicePool) ) {
         if ( nOpen > 0 ) {
           term.evaluate();
           this._dice = this._dice.concat(term.dice);
           term = term.total;
         }
         else {
           terms.push(term);
           return terms;
         }
       }
       term = String(term);
 
       // Match outer-bracketed groups
       const parts = term.replace(/{/g, ';{;').replace(/}([A-z0-9<=>]+)?/g, '$&;').split(";");
       for ( let t of parts ) {
         if ( t === "" ) continue;
         if ( nOpen > 0 ) terms[terms.length - 1] += t;
         else terms.push(t);
         if ( t === "{" ) nOpen = Math.max(1, nOpen + 1);
         if ( /}/.test(t) ) nOpen = Math.max(0, nOpen - 1);
       }
       return terms;
     }, []);
 
     // Close any un-closed pools
     for ( let i=0; i<nOpen; i++ ) terms[terms.length - 1] += "}";
 
     // Convert term groups to DicePool objects
     return terms.reduce((terms, term) => {
       if ( term === "" ) return terms;
       const isClosedPool = (term[0] === "{") && (term.indexOf("}") !== -1);
       if ( isClosedPool ) terms.push(DicePool.fromExpression(term, {}, this.data));
       else terms.push(term);
       return terms;
     }, []);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Safely evaluate a formulaic expression using a Proxy environment which is allowed access to Math commands
    * @param {string} expression     The formula expression to evaluate
    * @return {number|null}          The returned numeric result, or null if the outcome is not numeric
    * @private
    */
   _safeEval(expression) {
     return Roll.MATH_PROXY.safeEval(expression);
   }
 
   /* -------------------------------------------- */
   /*  Chat Messages                               */
   /* -------------------------------------------- */
 
   /**
    * Render the tooltip HTML for a Roll instance
    * @return {Promise<HTMLElement>}
    */
   getTooltip() {
     const parts = this.dice.map(d => {
       const cls = d.constructor;
       return {
         formula: d.expression,
         total: d.total,
         faces: d.faces,
         flavor: d.flavor,
         rolls: d.results.map(r => {
           const hasSuccess = r.success !== undefined;
           const hasFailure = r.failure !== undefined;
           const isMax = r.result === d.faces;
           const isMin = r.result === 1;
           return {
             result: cls.getResultLabel(r.result),
             classes: [
               cls.name.toLowerCase(),
               "d" + d.faces,
               r.success ? "success" : null,
               r.failure ? "failure" : null,
               r.rerolled ? "rerolled" : null,
               r.exploded ? "exploded" : null,
               r.discarded ? "discarded" : null,
               !(hasSuccess || hasFailure) && isMin ? "min" : null,
               !(hasSuccess || hasFailure) && isMax ? "max" : null
             ].filter(c => c).join(" ")
           }
         })
       };
     });
     return renderTemplate(this.constructor.TOOLTIP_TEMPLATE, { parts });
   }
 
   /* -------------------------------------------- */
 
   /**
    * Render a Roll instance to HTML
    * @param chatOptions {Object}      An object configuring the behavior of the resulting chat message.
    * @return {Promise.<HTMLElement>}  A Promise which resolves to the rendered HTML
    */
   async render(chatOptions = {}) {
     chatOptions = mergeObject({
       user: game.user._id,
       flavor: null,
       template: this.constructor.CHAT_TEMPLATE,
       blind: false
     }, chatOptions);
     const isPrivate = chatOptions.isPrivate;
 
     // Execute the roll, if needed
     if (!this._rolled) this.roll();
 
     // Define chat data
     const chatData = {
       formula: isPrivate ? "???" : this._formula,
       flavor: isPrivate ? null : chatOptions.flavor,
       user: chatOptions.user,
       tooltip: isPrivate ? "" : await this.getTooltip(),
       total: isPrivate ? "?" : Math.round(this.total * 100) / 100
     };
 
     // Render the roll display template
     return renderTemplate(chatOptions.template, chatData);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Transform a Roll instance into a ChatMessage, displaying the roll result.
    * This function can either create the ChatMessage directly, or return the data object that will be used to create.
    *
    * @param {object} messageData          The data object to use when creating the message
    * @param {options} [options]           Additional options which modify the created message.
    * @param {string|null} [options.rollMode]  The template roll mode to use for the message from CONFIG.Dice.rollModes
    * @param {boolean} [options.create=true]   Whether to automatically create the chat message, or only return the
    *                                          prepared chatData object.
    * @return {Promise|Object}             A promise which resolves to the created ChatMessage entity, if create is true
    *                                      or the Object of prepared chatData otherwise.
    */
   toMessage(messageData={}, {rollMode=null, create=true}={}) {
 
     // Perform the roll, if it has not yet been rolled
     if (!this._rolled) this.evaluate();
 
     // Prepare chat data
     messageData = mergeObject({
       user: game.user._id,
       type: CONST.CHAT_MESSAGE_TYPES.ROLL,
       content: this.total,
       sound: CONFIG.sounds.dice,
     }, messageData);
     messageData.roll = this;
 
     // Apply message options
     if ( rollMode ) ChatMessage.applyRollMode(messageData, rollMode);
 
     // Either create the message or just return the chat data
     return create ? CONFIG.ChatMessage.entityClass.create(messageData) : messageData;
   }
 
   /* -------------------------------------------- */
   /*  Saving and Loading                          */
   /* -------------------------------------------- */
 
   /**
    * Represent the data of the Roll as an object suitable for JSON serialization.
    * @return {Object}     Structured data which can be serialized into JSON
    */
   toJSON() {
     if ( !this._rolled ) throw new Error(`You cannot serialize an un-rolled Roll object`);
     return {
       class: this.constructor.name,
       dice: this._dice,
       formula: this._formula,
       terms: this.terms,
       results: this.results,
       total: this._total
     }
   }
 
   /* -------------------------------------------- */
 
   /**
    * Recreate a Roll instance using a provided data object
    * @param {object} data   Unpacked data representing the Roll
    * @return {Roll}         A reconstructed Roll instance
    */
   static fromData(data) {
     if (!("terms" in data)) {
       data = this._backwardsCompatibleRoll(data);
     }
 
     // Create the Roll instance
     const roll = new this(data.formula);
     roll.results = data.results;
     roll._total = data.total;
     roll._dice = data.dice.map(t => DiceTerm.fromData(t));
 
     // Expand terms
     roll.terms = data.terms.map(t => {
       if ( t.class ) {
         if ( t.class === "DicePool" ) return DicePool.fromData(t);
         else return DiceTerm.fromData(t);
       }
       return t;
     });
 
     // Return the reconstructed roll
     roll._rolled = true;
     return roll;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Recreate a Roll instance using a provided JSON string
    * @param {string} json   Serialized JSON data representing the Roll
    * @return {Roll}         A reconstructed Roll instance
    */
   static fromJSON(json) {
     const data = JSON.parse(json);
     const cls = CONFIG.Dice.rolls.find(cls => cls.name === data.class);
     if ( !cls ) throw new Error(`Unable to recreate ${data.class} instance from provided data`);
     return cls.fromData(data);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Construct a new Roll object from a parenthetical term of an outer Roll.
    * @param {string} term     The isolated parenthetical term, for example (4d6)
    * @param {object} data     The Roll data object, provided by the outer Roll
    * @return {Roll}           An inner Roll object constructed from the term
    */
   static fromTerm(term, data) {
     const match = term.match(this.PARENTHETICAL_RGX);
     return new this(match ? match[1] : term, data);
   }
 
   /* -------------------------------------------- */
   /*  Interface Helpers                           */
   /* -------------------------------------------- */
 
   /**
    * Expand an inline roll element to display it's contained dice result as a tooltip
    * @param {HTMLAnchorElement} a     The inline-roll button
    * @return {Promise<void>}
    * @private
    */
   static async _expandInlineResult(a) {
     if ( !a.classList.contains("inline-roll") ) return;
     if ( a.classList.contains("expanded") ) return;
 
     // Create a new tooltip
     const roll = Roll.fromJSON(unescape(a.dataset.roll));
     const tip = document.createElement("div");
     tip.innerHTML = await roll.getTooltip();
 
     // Add the tooltip
     const tooltip = tip.children[0];
     a.appendChild(tooltip);
     a.classList.add("expanded");
 
     // Set the position
     const pa = a.getBoundingClientRect();
     const pt = tooltip.getBoundingClientRect();
     tooltip.style.left = `${Math.min(pa.x, window.innerWidth - (pt.width + 3))}px`;
     tooltip.style.top = `${Math.min(pa.y + pa.height + 3, window.innerHeight - (pt.height + 3))}px`;
     const zi = getComputedStyle(a).zIndex;
     tooltip.style.zIndex = Number.isNumeric(zi) ? zi + 1 : 100;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Collapse an expanded inline roll to conceal it's tooltip
    * @param {HTMLAnchorElement} a     The inline-roll button
    * @private
    */
   static _collapseInlineResult(a) {
     if ( !a.classList.contains("inline-roll") ) return;
     if ( !a.classList.contains("expanded") ) return;
     const tooltip = a.querySelector(".dice-tooltip");
     if ( tooltip ) tooltip.remove();
     return a.classList.remove("expanded");
   }
 
   /* -------------------------------------------- */
   /*  Deprecations                                */
   /* -------------------------------------------- */
 
   /**
    * Provide backwards compatibility for Roll data prior to 0.7.0
    * @deprecated since 0.7.0
    * @private
    */
   static _backwardsCompatibleRoll(data) {
     data.terms = data.parts.map(p => {
       if ( /_d[0-9]+/.test(p) ) {
         let i = parseInt(p.replace("_d", ""));
         return data.dice[i];
       }
       return p;
     });
     delete data.parts;
     data.dice = [];
     data.results = data.result.split(" + ").map(Number);
     delete data.result;
     return data;
   }
 
   /* -------------------------------------------- */
 
   /**
    * @deprecated since 0.7.0
    * @see {@link Roll#terms}
    */
   get parts() {
     console.warn(`You are referencing Roll#parts which is now deprecated in favor of Roll#terms`);
     return this.terms;
   }
 
   /* -------------------------------------------- */
 
   /**
    * @deprecated since 0.7.0
    * @see {@link Roll#evaluate}
    */
   static minimize(formula) {
     console.warn(`The Roll.minimize(formula) function is deprecated in favor of Roll#evaluate({minimize: true})`);
     return new this(formula).evaluate({minimize: true});
   }
 
   /* -------------------------------------------- */
 
   /**
    * @deprecated since 0.7.0
    * @see {@link Roll#evaluate}
    */
   static maximize(formula) {
     console.warn(`The Roll.maximize(formula) function is deprecated in favor of Roll#evaluate({maximize: true})`);
     return new this(formula).evaluate({maximize: true});
   }
 }
 