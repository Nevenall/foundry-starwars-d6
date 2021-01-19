/**
 * An abstract base class for any term which appears in a dice roll formula
 * @abstract
 *
 * @param {object} termData                 Data used to create the Dice Term, including the following:
 * @param {number} termData.number          The number of dice of this term to roll, before modifiers are applied
 * @param {number} termData.faces           The number of faces on each die of this type
 * @param {string[]} termData.modifiers     An array of modifiers applied to the results
 * @param {object} termData.options         Additional options that modify the term
 */
class DiceTerm {
   constructor({number=1, faces=6, modifiers=[], options={}}={}) {
 
     /**
      * The number of dice of this term to roll, before modifiers are applied
      * @type {number}
      */
     this.number = number;
 
     /**
      * The number of faces on the die
      * @type {number}
      */
     this.faces = faces;
 
     /**
      * An Array of dice term modifiers which are applied
      * @type {string[]}
      */
     this.modifiers = modifiers;
 
     /**
      * An object of additional options which modify the dice term
      * @type {object}
      */
     this.options = options;
 
     /**
      * The array of dice term results which have been rolled
      * @type {object[]}
      */
     this.results = [];
 
     /**
      * An internal flag for whether the dice term has been evaluated
      * @type {boolean}
      * @private
      */
     this._evaluated = false;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Return the dice expression portion of the full term formula, excluding any flavor text.
    * @type {string}
    */
   get expression() {
     const x = this.constructor.DENOMINATION === "d" ? this.faces : this.constructor.DENOMINATION;
     return `${this.number}d${x}${this.modifiers.join("")}`;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Return a standardized representation for the displayed formula associated with this DiceTerm
    * @type {string}
    */
   get formula() {
     let f = this.expression;
     if ( this.flavor ) f += `[${this.flavor}]`;
     return f;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Return the flavor text associated with a particular DiceTerm, possibly an empty string if the term is flavorless.
    * @type {string}
    */
   get flavor() {
     return this.options.flavor || "";
   }
 
   /* -------------------------------------------- */
 
   /**
    * Return the total result of the DiceTerm if it has been evaluated
    * @type {number|null}
    */
   get total() {
     if ( !this._evaluated ) return null;
     return this.results.reduce((t, r) => {
       if ( !r.active ) return t;
       if ( r.count !== undefined ) return t + r.count;
       else return t + r.result;
     }, 0);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Return an array of rolled values which are still active within this term
    * @type {number[]}
    */
   get values() {
     return this.results.reduce((arr, r) => {
       if ( !r.active ) return arr;
       arr.push(r.result);
       return arr;
     }, []);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Alter the DiceTerm by adding or multiplying the number of dice which are rolled
    * @param {number} multiply   A factor to multiply. Dice are multiplied before any additions.
    * @param {number} add        A number of dice to add. Dice are added after multiplication.
    * @return {DiceTerm}         The altered term
    */
   alter(multiply, add) {
     if ( this._evaluated ) throw new Error(`You may not alter a DiceTerm after it has already been evaluated`);
     multiply = Number.isFinite(multiply) && (multiply >= 0) ? multiply : 1;
     add = Number.isInteger(add) ? add : 0;
     if ( multiply >= 0 ) this.number = Math.round(this.number * multiply);
     if ( add ) this.number += add;
     return this;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Evaluate the roll term, populating the results Array.
    * @param {boolean} [minimize]    Apply the minimum possible result for each roll.
    * @param {boolean} [maximize]    Apply the maximum possible result for each roll.
    * @returns {DiceTerm}    The evaluated dice term
    */
   evaluate({minimize=false, maximize=false}={}) {
     if ( this._evaluated ) {
       throw new Error(`This ${this.constructor.name} has already been evaluated and is immutable`);
     }
 
     // Roll the initial number of dice
     for ( let n=1; n <= this.number; n++ ) {
       this.roll({minimize, maximize});
     }
 
     // Apply modifiers
     this._evaluateModifiers();
 
     // Return the evaluated term
     this._evaluated = true;
     return this;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Roll the DiceTerm by mapping a random uniform draw against the faces of the dice term.
    * @param {boolean} [minimize]    Apply the minimum possible result instead of a random result.
    * @param {boolean} [maximize]    Apply the maximum possible result instead of a random result.
    * @return {object}
    */
   roll({minimize=false, maximize=false}={}) {
     const rand = CONFIG.Dice.randomUniform();
     let result = Math.ceil(rand * this.faces);
     if ( minimize ) result = Math.min(1, this.faces);
     if ( maximize ) result = this.faces;
     const roll = {result, active: true};
     this.results.push(roll);
     return roll;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Return a string used as the label for each rolled result
    * @param {string} result     The numeric result
    * @return {string}           The result label
    */
   static getResultLabel(result) {
     return String(result);
   }
 
   /* -------------------------------------------- */
   /*  Modifier Helpers                            */
   /* -------------------------------------------- */
 
   /**
    * Sequentially evaluate each dice roll modifier by passing the term to its evaluation function
    * Augment or modify the results array.
    * @private
    */
   _evaluateModifiers() {
     const cls = this.constructor;
     for ( let m of this.modifiers ) {
       const command = m.match(/[A-z]+/)[0].toLowerCase();
       let fn = cls.MODIFIERS[command];
       if ( typeof fn === "string" ) fn = this[fn];
       if ( fn instanceof Function ) {
         fn.call(this, m);
       }
     }
   }
 
   /* -------------------------------------------- */
 
   /**
    * A helper comparison function.
    * Returns a boolean depending on whether the result compares favorably against the target.
    * @param {number} result         The result being compared
    * @param {string} comparison     The comparison operator in [=,<,<=,>,>=]
    * @param {number} target         The target value
    * @return {boolean}              Is the comparison true?
    */
   static compareResult(result, comparison, target) {
     switch ( comparison ) {
       case "=":
         return result === target;
       case "<":
         return result < target;
       case "<=":
         return result <= target;
       case ">":
         return result > target;
       case ">=":
         return result >= target;
     }
   }
 
   /* -------------------------------------------- */
 
   /**
    * A helper method to modify the results array of a dice term by flagging certain results are kept or dropped.
    * @param {object[]} results      The results array
    * @param {number} number         The number to keep or drop
    * @param {boolean} [keep]        Keep results?
    * @param {boolean} [highest]     Keep the highest?
    * @return {object[]}             The modified results array
    */
   static _keepOrDrop(results, number, {keep=true, highest=true}={}) {
 
     // Sort remaining active results in ascending (keep) or descending (drop) order
     const ascending = keep === highest;
     const values = results.reduce((arr, r) => {
       if ( r.active ) arr.push(r.result);
       return arr;
     }, []).sort((a, b) => ascending ? a - b : b - a);
 
     // Determine the cut point, beyond which to discard
     number = Math.clamped(keep ? values.length - number : number, 0, values.length);
     const cut = values[number];
 
     // Track progress
     let discarded = 0;
     const ties = [];
     let comp = ascending ? "<" : ">";
 
     // First mark results on the wrong side of the cut as discarded
     results.forEach(r => {
       if ( !r.active ) return;  // Skip results which have already been discarded
       let discard = this.compareResult(r.result, comp, cut);
       if ( discard ) {
         r.discarded = true;
         r.active = false;
         discarded++;
       }
       else if ( r.result === cut ) ties.push(r);
     });
 
     // Next discard ties until we have reached the target
     ties.forEach(r => {
       if ( discarded < number ) {
         r.discarded = true;
         r.active = false;
         discarded++;
       }
     });
     return results;
   }
 
   /* -------------------------------------------- */
 
   /**
    * A reusable helper function to handle the identification and deduction of failures
    */
   static _applyCount(results, comparison, target, {flagSuccess=false, flagFailure=false}={}) {
     for ( let r of results ) {
       let success = this.compareResult(r.result, comparison, target);
       if (flagSuccess) {
         r.success = success;
         if (success) delete r.failure;
       }
       else if (flagFailure ) {
         r.failure = success;
         if (success) delete r.success;
       }
       r.count = success ? 1 : 0;
     }
   }
 
   /* -------------------------------------------- */
 
   /**
    * A reusable helper function to handle the identification and deduction of failures
    */
   static _applyDeduct(results, comparison, target, {deductFailure=false, invertFailure=false}={}) {
     for ( let r of results ) {
 
       // Flag failures if a comparison was provided
       if (comparison) {
         const fail = this.compareResult(r.result, comparison, target);
         if ( fail ) {
           r.failure = true;
           delete r.success;
         }
       }
 
       // Otherwise treat successes as failures
       else {
         if ( r.success === false ) {
           r.failure = true;
           delete r.success;
         }
       }
 
       // Deduct failures
       if ( deductFailure ) {
         if ( r.failure ) r.count = -1;
       }
       else if ( invertFailure ) {
         if ( r.failure ) r.count = -1 * r.result;
       }
     }
   }
 
   /* -------------------------------------------- */
   /*  Factory Methods                             */
   /* -------------------------------------------- */
 
   /**
    * Construct a DiceTerm from a provided data object
    * @param {object} data         Provided data from an un-serialized term
    * @return {DiceTerm}           The constructed DiceTerm
    */
   static fromData(data) {
     // TODO: Backwards compatibility for pre-0.7.0 dice
     if (!("number" in data)) data = this._backwardsCompatibleTerm(data);
     const cls = Object.values(CONFIG.Dice.terms).find(c => c.name === data.class) || Die;
     return cls.fromResults(data, data.results);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Parse a provided roll term expression, identifying whether it matches this type of term.
    * @param {string} expression
    * @param {object} options            Additional term options
    * @return {DiceTerm|null}            The constructed DiceTerm instance
    */
   static fromExpression(expression, options={}) {
     const match = this.matchTerm(expression);
     if ( !match ) return null;
     let [number, denomination, modifiers, flavor] = match.slice(1);
 
     // Get the denomination of DiceTerm
     denomination = denomination.toLowerCase();
     const term = denomination in CONFIG.Dice.terms ? CONFIG.Dice.terms[denomination] : Die;
     if ( !term ) throw new Error(`Die denomination ${denomination} not registered in CONFIG.Dice.terms`);
 
     // Get the term arguments
     number = Number.isNumeric(number) ? parseInt(number) : 1;
     const faces = Number.isNumeric(denomination) ? parseInt(denomination) : null;
     modifiers = Array.from((modifiers || "").matchAll(DiceTerm.MODIFIER_REGEX)).map(m => m[0]);
     if ( flavor ) options.flavor = flavor;
 
     // Construct a term of the appropriate denomination
     return new term({number, faces, modifiers, options});
   }
 
   /* -------------------------------------------- */
 
   /**
    * Check if the expression matches this type of term
    * @param {string} expression               The expression to parse
    * @param {boolean} [imputeNumber=true]     Allow the number of dice to be optional, i.e. "d6"
    * @return {RegExpMatchArray|null}
    */
   static matchTerm(expression, {imputeNumber=true}={}) {
     const rgx = new RegExp(`^([0-9]+)${imputeNumber ? "?" : ""}[dD]([A-z]|[0-9]+)${DiceTerm.MODIFIERS_REGEX}${DiceTerm.FLAVOR_TEXT_REGEX}`);
     const match = expression.match(rgx);
     return match || null;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Create a "fake" dice term from a pre-defined array of results
    * @param {object} options        Arguments used to initialize the term
    * @param {object[]} results      An array of pre-defined results
    * @return {DiceTerm}
    *
    * @example
    * let d = new Die({faces: 6, number: 4, modifiers: ["r<3"]});
    * d.evaluate();
    * let d2 = Die.fromResults({faces: 6, number: 4, modifiers: ["r<3"]}, d.results);
    */
   static fromResults(options, results) {
     const term = new this(options);
     term.results = results;
     term._evaluated = true;
     return term;
   }
 
   /* -------------------------------------------- */
 
   /**
    * Serialize the DiceTerm to a JSON string which allows it to be saved in the database or embedded in text.
    * This method should return an object suitable for passing to the JSON.stringify function.
    * @return {object}
    */
   toJSON() {
     return {
       class: this.constructor.name,
       number: this.number,
       faces: this.faces,
       modifiers: this.modifiers,
       options: this.options,
       results: this.results
     }
   }
 
   /* -------------------------------------------- */
 
   /**
    * Reconstruct a DiceTerm instance from a provided JSON string
    * @param {string} json   A serialized JSON representation of a DiceTerm
    * @return {DiceTerm}     A reconstructed DiceTerm from the provided JSON
    */
   static fromJSON(json) {
     let data;
     try {
       data = JSON.parse(json);
     } catch(err) {
       throw new Error("You must pass a valid JSON string");
     }
     return this.fromData(data);
   }
 
   /* -------------------------------------------- */
 
   /**
    * Provide backwards compatibility for Die syntax prior to 0.7.0
    * @private
    */
   static _backwardsCompatibleTerm(data) {
     const match = this.matchTerm(data.formula);
     data.number = parseInt(match[1]);
     data.results = data.rolls.map(r => {
       r.result = r.roll;
       delete r.roll;
       r.active = r.active !== false;
       return r;
     });
     delete data.rolls;
     delete data.formula;
     return data;
   }
 }