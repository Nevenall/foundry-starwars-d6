/**
 * An interface and API for constructing and evaluating dice rolls.
 * The basic structure for a dice roll is a string formula and an object of data against which to parse it.
 *
 * @param {string} formula    The string formula to parse
 * @param {object} data       The data object against which to parse attributes within the formula
 *
 * @example
 * // Attack with advantage!
 * let r = new Roll("2d20kh + @prof + @strMod", {prof: 2, strMod: 4});
 *
 * // The parsed terms of the roll formula
 * console.log(r.terms);    // [Die, OperatorTerm, NumericTerm, OperatorTerm, NumericTerm]
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
export default class MyRoll extends Roll {
   constructor(formula, data = {}, options = {}) {
      super(formula, data, options)

      /**
       * The original provided data object which substitutes into attributes of the roll formula
       * @type {Object}
       */
      this.data = this._prepareData(data);

      /**
       * Options which modify or describe the Roll
       * @type {object}
       */
      this.options = options;

      /**
       * The identified terms of the Roll
       * @type {RollTerm[]}
       */
      this.terms = this.constructor.parse(formula, this.data);

      /**
       * An array of inner DiceTerms which were evaluated as part of the Roll evaluation
       * @type {DiceTerm[]}
       */
      this._dice = [];

      /**
       * Store the original cleaned formula for the Roll, prior to any internal evaluation or simplification
       * @type {string}
       */
      this._formula = this.constructor.getFormula(this.terms);

      /**
       * Track whether this Roll instance has been evaluated or not. Once evaluated the Roll is immutable.
       * @type {boolean}
       */
      this._evaluated = false;

      /**
       * Cache the numeric total generated through evaluation of the Roll.
       * @type {number}
       * @private
       */
      this._total = undefined;
   }

   /**
    * A Proxy environment for safely evaluating a string using only available Math functions
    * @type {Math}
    */
   static MATH_PROXY = new Proxy(Math, { has: () => true, get: (t, k) => k === Symbol.unscopables ? undefined : t[k] });

   /**
    * The HTML template path used to render a complete Roll object to the chat log
    * @type {string}
    */
   static CHAT_TEMPLATE = "templates/dice/roll.html";

   /**
    * The HTML template used to render an expanded Roll tooltip to the chat log
    * @type {string}
    */
   static TOOLTIP_TEMPLATE = "templates/dice/tooltip.html";

   /* -------------------------------------------- */

   /**
    * Prepare the data structure used for the Roll.
    * This is factored out to allow for custom Roll classes to do special data preparation using provided input.
    * @param {object} data   Provided roll data
    * @returns {object}      The prepared data object
    * @protected
    */
   _prepareData(data) {
      return data;
   }

   /* -------------------------------------------- */
   /*  Roll Attributes                             */
   /* -------------------------------------------- */

   /**
    * Return an Array of the individual DiceTerm instances contained within this Roll.
    * @return {DiceTerm[]}
    */
   get dice() {
      return this._dice.concat(this.terms.reduce((dice, t) => {
         if (t instanceof DiceTerm) dice.push(t);
         else if (t instanceof PoolTerm) dice = dice.concat(t.dice);
         return dice;
      }, []));
   }

   /* -------------------------------------------- */

   /**
    * Return a standardized representation for the displayed formula associated with this Roll.
    * @return {string}
    */
   get formula() {
      return this.constructor.getFormula(this.terms);
   }

   /* -------------------------------------------- */

   /**
    * The resulting arithmetic expression after rolls have been evaluated
    * @return {string}
    */
   get result() {
      return this.terms.map(t => t.total).join("");
   }

   /* -------------------------------------------- */

   /**
    * Return the total result of the Roll expression if it has been evaluated.
    * @type {number}
    */
   get total() {
      return this._total;
   }

   /* -------------------------------------------- */
   /*  Roll Instance Methods                       */
   /* -------------------------------------------- */

   /**
    * Alter the Roll expression by adding or multiplying the number of dice which are rolled
    * @param {number} multiply   A factor to multiply. Dice are multiplied before any additions.
    * @param {number} add        A number of dice to add. Dice are added after multiplication.
    * @param {boolean} [multiplyNumeric]  Apply multiplication factor to numeric scalar terms
    * @return {Roll}             The altered Roll expression
    */
   alter(multiply, add, { multiplyNumeric = false } = {}) {
      if (this._evaluated) throw new Error("You may not alter a Roll which has already been evaluated");

      // Alter dice and numeric terms
      this.terms = this.terms.map(term => {
         if (term instanceof DiceTerm) return term.alter(multiply, add);
         else if ((term instanceof NumericTerm) && multiplyNumeric) term.number *= multiply;
         return term;
      });

      // Update the altered formula and return the altered Roll
      this._formula = this.constructor.getFormula(this.terms);
      return this;
   }

   /* -------------------------------------------- */

   /**
    * Clone the Roll instance, returning a new Roll instance that has not yet been evaluated.
    * @return {Roll}
    */
   clone() {
      return new this.constructor(this._formula, this.data, this.options);
   }

   /* -------------------------------------------- */

   /**
    * Execute the Roll, replacing dice and evaluating the total result
    * @param {object} [options={}]     Options which inform how the Roll is evaluated
    * @param {boolean} [options.minimize=false]    Minimize the result, obtaining the smallest possible value.
    * @param {boolean} [options.maximize=false]    Maximize the result, obtaining the largest possible value.
    * @param {boolean} [options.async=false]       Evaluate the roll asynchronously, receiving a Promise as the returned value.
    *                                              This will become the default behavior in version 10.x
    * @returns {Roll|Promise<Roll>}    The evaluated Roll instance
    *
    * @example
    * let r = new Roll("2d6 + 4 + 1d4");
    * r.evaluate();
    * console.log(r.result); // 5 + 4 + 2
    * console.log(r.total);  // 11
    */
   evaluate({ minimize = false, maximize = false, async } = {}) {
      if (this._evaluated) {
         throw new Error(`The ${this.constructor.name} has already been evaluated and is now immutable`);
      }
      this._evaluated = true;
      if (CONFIG.debug.dice) console.debug(`Evaluating roll with formula ${this.formula}`);

      // Migration path for async rolls
      if (minimize || maximize) async = false;
      if (async === undefined) {
         console.warn(`Roll#evaluate is becoming asynchronous. In the short term you may pass async=true or async=false to evaluation options to nominate your preferred behavior.`);
         async = false;
      }
      return async ? this._evaluate({ minimize, maximize }) : this._evaluateSync({ minimize, maximize });
   }

   /* -------------------------------------------- */

   /**
    * Evaluate the roll asynchronously.
    * A temporary helper method used to migrate behavior from 0.7.x (sync by default) to 0.9.x (async by default).
    * @returns {Promise<Roll>}
    * @private
    */
   async _evaluate({ minimize = false, maximize = false } = {}) {

      // Step 1 - Replace intermediate terms with evaluated numbers
      const intermediate = [];
      for (let term of this.terms) {
         if (!(term instanceof RollTerm)) {
            throw new Error("Roll evaluation encountered an invalid term which was not a RollTerm instance");
         }
         if (term.isIntermediate) {
            await term.evaluate({ minimize, maximize, async: true });
            this._dice = this._dice.concat(term.dice);
            term = new NumericTerm({ number: term.total, options: term.options });
         }
         intermediate.push(term);
      }
      this.terms = intermediate;

      // Step 2 - Simplify remaining terms
      this.terms = this.constructor.simplifyTerms(this.terms);

      // Step 3 - Evaluate remaining terms
      for (let term of this.terms) {
         if (!term._evaluated) await term.evaluate({ minimize, maximize, async: true });
      }

      // Step 4 - Evaluate the final expression
      this._total = this._evaluateTotal();
      return this;
   }

   /* -------------------------------------------- */

   /**
    * Evaluate the roll synchronously.
    * A temporary helper method used to migrate behavior from 0.7.x (sync by default) to 0.9.x (async by default).
    * @returns {Roll}
    * @private
    */
   _evaluateSync({ minimize = false, maximize = false } = {}) {

      // Step 1 - Replace intermediate terms with evaluated numbers
      this.terms = this.terms.map(term => {
         if (!(term instanceof RollTerm)) {
            throw new Error("Roll evaluation encountered an invalid term which was not a RollTerm instance");
         }
         if (term.isIntermediate) {
            term.evaluate({ minimize, maximize, async: false });
            this._dice = this._dice.concat(term.dice);
            return new NumericTerm({ number: term.total, options: term.options });
         }
         return term;
      });

      // Step 2 - Simplify remaining terms
      this.terms = this.constructor.simplifyTerms(this.terms);

      // Step 3 - Evaluate remaining terms
      for (let term of this.terms) {
         if (!term._evaluated) term.evaluate({ minimize, maximize, async: false });
      }

      // Step 4 - Evaluate the final expression
      this._total = this._evaluateTotal();
      return this;
   }

   /* -------------------------------------------- */

   /**
    * Safely evaluate the final total result for the Roll using its component terms.
    * @returns {number}    The evaluated total
    * @private
    */
   _evaluateTotal() {
      const expression = this.terms.map(t => t.total).join(" ");
      const total = Roll.safeEval(expression);
      if (!Number.isNumeric(total)) {
         throw new Error(game.i18n.format("DICE.ErrorNonNumeric", { formula: this.formula }));
      }
      return total;
   }

   /* -------------------------------------------- */

   /**
    * Alias for evaluate.
    * @see {Roll#evaluate}
    */
   roll(options = {}) {
      return this.evaluate(options);
   }

   /* -------------------------------------------- */

   /**
    * Create a new Roll object using the original provided formula and data.
    * Each roll is immutable, so this method returns a new Roll instance using the same data.
    * @param {object} [options={}]     Evaluation options passed to Roll#evaluate
    * @return {Roll}                   A new Roll object, rolled using the same formula and data
    */
   reroll(options = {}) {
      const r = this.clone();
      return r.evaluate(options);
   }

   /* -------------------------------------------- */
   /*  Static Class Methods                        */
   /* -------------------------------------------- */

   /**
    * A factory method which constructs a Roll instance using the default configured Roll class.
    * @param {string} formula        The formula used to create the Roll instance
    * @param {object} [data={}]      The data object which provides component data for the formula
    * @param {object} [options={}]   Additional options which modify or describe this Roll
    * @return {Roll}                 The constructed Roll instance
    */
   static create(formula, data = {}, options = {}) {
      const cls = CONFIG.Dice.rolls[0];
      return new cls(formula, data, options);
   }

   /* -------------------------------------------- */

   /**
    * Transform an array of RollTerm objects into a cleaned string formula representation.
    * @param {RollTerm[]} terms      An array of terms to represent as a formula
    * @returns {string}              The string representation of the formula
    */
   static getFormula(terms) {
      return terms.map(t => t.formula).join("");
   }

   /* -------------------------------------------- */

   /**
    * A sandbox-safe evaluation function to execute user-input code with access to scoped Math methods.
    * @param {string} expression   The input string expression
    * @returns {number}            The numeric evaluated result
    */
   static safeEval(expression) {
      let result;
      try {
         const src = 'with (sandbox) { return ' + expression + '}';
         const evl = new Function('sandbox', src);
         result = evl(Roll.MATH_PROXY);
      } catch {
         result = undefined;
      }
      if (!Number.isNumeric(result)) {
         throw new Error(`Roll.safeEval produced a non-numeric result from expression "${expression}"`);
      }
      return result;
   };

   /* -------------------------------------------- */

   /**
    * After parenthetical and arithmetic terms have been resolved, we need to simplify the remaining expression.
    * Any remaining string terms need to be combined with adjacent non-operators in order to construct parsable terms.
    * @param {RollTerm[]} terms      An array of terms which is eligible for simplification
    * @returns {RollTerm[]}          An array of simplified terms
    */
   static simplifyTerms(terms) {

      // Simplify terms by combining with pending strings
      let simplified = terms.reduce((terms, term) => {
         const prior = terms[terms.length - 1];
         const isOperator = term instanceof OperatorTerm;

         // Combine a non-operator term with prior StringTerm
         if (!isOperator && (prior instanceof StringTerm)) {
            prior.term += term.total;
            foundry.utils.mergeObject(prior.options, term.options);
            return terms;
         }

         // Combine StringTerm with a prior non-operator term
         const priorOperator = prior instanceof OperatorTerm;
         if (prior && !priorOperator && (term instanceof StringTerm)) {
            term.term = String(prior.total) + term.term;
            foundry.utils.mergeObject(term.options, prior.options);
            terms[terms.length - 1] = term;
            return terms;
         }

         // Otherwise continue
         terms.push(term);
         return terms;
      }, []);

      // Convert remaining String terms to a RollTerm which can be evaluated
      simplified = simplified.map(term => {
         if (!(term instanceof StringTerm)) return term;
         const t = this._classifyStringTerm(term.formula, { intermediate: false });
         t.options = term.options;
         return t;
      });

      // Eliminate leading or trailing arithmetic
      if ((simplified[0] instanceof OperatorTerm) && (simplified[0].operator !== "-")) simplified.shift();
      if (simplified[terms.length - 1] instanceof OperatorTerm) simplified.pop();
      return simplified;
   }

   /* -------------------------------------------- */

   /**
    * Simulate a roll and evaluate the distribution of returned results
    * @param {string} formula    The Roll expression to simulate
    * @param {number} n          The number of simulations
    * @return {number[]}         The rolled totals
    */
   static simulate(formula, n = 10000) {
      const results = [...Array(n)].map(i => {
         let r = new this(formula);
         return r.evaluate().total;
      }, []);
      const summary = results.reduce((sum, v) => {
         sum.total = sum.total + v;
         if ((sum.min === null) || (v < sum.min)) sum.min = v;
         if ((sum.max === null) || (v > sum.max)) sum.max = v;
         return sum;
      }, { total: 0, min: null, max: null });
      summary.mean = summary.total / n;
      console.log(`Formula: ${formula} | Iterations: ${n} | Mean: ${summary.mean} | Min: ${summary.min} | Max: ${summary.max}`);
      return results;
   }

   /* -------------------------------------------- */
   /*  Roll Formula Parsing                        */
   /* -------------------------------------------- */

   /**
    * Parse a formula by following an order of operations:
    *
    * Step 1: Replace formula data
    * Step 2: Split outer-most parenthetical groups
    * Step 3: Further split outer-most dice pool groups
    * Step 4: Further split string terms on arithmetic operators
    * Step 5: Classify all remaining strings
    *
    * @param {string} formula      The original string expression to parse
    * @param {object} data         A data object used to substitute for attributes in the formula
    * @returns {RollTerm[]}        A parsed array of RollTerm instances
    */
   static parse(formula, data) {
      if (!formula) return [];

      // Step 1: Replace formula data and remove all spaces
      let replaced = this.replaceFormulaData(formula, data, { missing: "0" });

      // Step 2: Split outer-most outer-most parenthetical groups
      let terms = this._splitParentheses(replaced);

      // Step 3: Split additional dice pool groups which may contain inner rolls
      terms = terms.flatMap(term => {
         return typeof term === "string" ? this._splitPools(term) : term;
      });

      // Step 4: Further split string terms on arithmetic operators
      terms = terms.flatMap(term => {
         return typeof term === "string" ? this._splitOperators(term) : term;
      });

      // Step 5: Classify all remaining strings
      terms = terms.map((t, i) => this._classifyStringTerm(t, {
         intermediate: true,
         prior: terms[i - 1],
         next: terms[i + 1]
      }));

      // Step 6: turn one of the die into the wild die
      terms = this.AddWildDie(terms)

      return terms;
   }

   static AddWildDie(terms) {
      let dice = terms.find(el => el?.options?.sw)
      if (dice) {
         dice.number--
         terms.unshift(new Die({ number: 1, faces: 6, modifiers: ["x"], options: { wildDie: true } }))
         terms.unshift(new Die({ number: 1, faces: 6, modifiers: ["x"], options: { wildDie: true } }))
      }
      return terms
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
   static replaceFormulaData(formula, data, { missing, warn = false } = {}) {
      let dataRgx = new RegExp(/@([a-z.0-9_\-]+)/gi);
      return formula.replace(dataRgx, (match, term) => {
         let value = foundry.utils.getProperty(data, term);
         if (value == null) {
            if (warn && ui.notifications) ui.notifications.warn(game.i18n.format("DICE.WarnMissingData", { match }));
            return (missing !== undefined) ? String(missing) : match;
         }
         return String(value).trim();
      });
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
         r.evaluate({ async: false });
         return true;
      }

      // If we weren't able to evaluate, the formula is invalid
      catch (err) {
         return false;
      }
   }

   /* -------------------------------------------- */

   /**
    * Split a formula by identifying its outer-most parenthetical and math terms
    * @param {string} _formula      The raw formula to split
    * @returns {string[]}          An array of terms, split on parenthetical terms
    * @private
    */
   static _splitParentheses(_formula) {
      return this._splitGroup(_formula, {
         openRegexp: ParentheticalTerm.OPEN_REGEXP,
         closeRegexp: ParentheticalTerm.CLOSE_REGEXP,
         openSymbol: "(",
         closeSymbol: ")",
         onClose: group => {

            // Extract group arguments
            const fn = group.open.slice(0, -1);
            const expression = group.terms.join("");
            const options = { flavor: group.flavor ? group.flavor.slice(1, -1) : undefined };

            // Classify the resulting terms
            const terms = [];
            if (fn in Math) {
               const args = this._splitMathArgs(expression);
               terms.push(new MathTerm({ fn, terms: args, options }));
            }
            else {
               if (fn) terms.push(fn);
               terms.push(new ParentheticalTerm({ term: expression, options }));
            }
            return terms;
         }
      });
   }

   /* -------------------------------------------- */

   /**
    * Handle closing of a parenthetical term to create a MathTerm expression with a function and arguments
    * @returns {MathTerm[]}
    * @private
    */
   static _splitMathArgs(expression) {
      return expression.split(",").reduce((args, t) => {
         t = t.trim();
         if (!t) return args;  // Blank args
         if (!args.length) {   // First arg
            args.push(t);
            return args;
         }
         const p = args[args.length - 1];  // Prior arg
         const priorValid = Roll.validate(p);
         if (priorValid) args.push(t);
         else args[args.length - 1] = [p, t].join(","); // Collect inner parentheses or pools
         return args;
      }, []);
   }

   /* -------------------------------------------- */

   /**
    * Split a formula by identifying its outer-most dice pool terms
    * @param {string} _formula      The raw formula to split
    * @returns {string[]}          An array of terms, split on parenthetical terms
    * @private
    */
   static _splitPools(_formula) {
      return this._splitGroup(_formula, {
         openRegexp: PoolTerm.OPEN_REGEXP,
         closeRegexp: PoolTerm.CLOSE_REGEXP,
         openSymbol: "{",
         closeSymbol: "}",
         onClose: group => {
            const terms = this._splitMathArgs(group.terms.join(""));
            const modifiers = Array.from(group.close.slice(1).matchAll(DiceTerm.MODIFIER_REGEXP)).map(m => m[0]);
            const options = { flavor: group.flavor ? group.flavor.slice(1, -1) : undefined };
            return [new PoolTerm({ terms, modifiers, options })];
         }
      })
   }

   /* -------------------------------------------- */

   /**
    * Split a formula by identifying its outer-most groups using a certain group symbol like parentheses or brackets.
    * @param {string} _formula     The raw formula to split
    * @param {object} options      Options that configure how groups are split
    * @returns {string[]}          An array of terms, split on dice pool terms
    * @private
    */
   static _splitGroup(_formula, { openRegexp, closeRegexp, openSymbol, closeSymbol, onClose } = {}) {
      let { formula, flavors } = this._extractFlavors(_formula);

      // Split the formula on parentheses
      const parts = formula.replace(openRegexp, ";$&;").replace(closeRegexp, ";$&;").split(";");
      let terms = [];
      let nOpen = 0;
      let group = { openIndex: undefined, open: "", terms: [], close: "", closeIndex: undefined, flavor: undefined };

      // Handle closing a group
      const closeGroup = t => {

         // Identify closing flavor text (and remove it)
         const flavor = t.match(/%F[0-9]+%/);
         if (flavor) {
            group.flavor = this._restoreFlavor(flavor[0], flavors);
            t = t.slice(0, flavor.index);
         }

         // Treat the remainder as the closing symbol
         group.close = t;

         // Restore flavor to member terms
         group.terms = group.terms.map(t => this._restoreFlavor(t, flavors));
         terms = terms.concat(onClose(group));
      }

      // Map parts to parenthetical groups
      for (let t of parts) {
         t = t.trim();
         if (!t) continue;

         // New open group
         if (t.endsWith(openSymbol)) {
            nOpen++;

            // Open a new group
            if (nOpen === 1) {
               group = { open: t, terms: [], close: "", flavor: undefined };
               continue;
            }
         }

         // Continue an opened group
         if (nOpen > 0) {
            if (t.startsWith(closeSymbol)) {
               nOpen--;

               // Close the group
               if (nOpen === 0) {
                  closeGroup(t);
                  continue;
               }
            }
            group.terms.push(t);
            continue;
         }

         // Regular remaining terms
         terms.push(t);
      }

      // If the group was not completely closed, continue closing it
      if (nOpen !== 0) {
         throw new Error(`Unbalanced group missing opening ${openSymbol} or closing ${closeSymbol}`);
      }

      // Restore withheld flavor text and re-combine strings
      terms = terms.reduce((terms, t) => {
         if (typeof t === "string") { // Re-combine string terms
            t = this._restoreFlavor(t, flavors);
            if (typeof terms[terms.length - 1] === "string") terms[terms.length - 1] = terms[terms.length - 1] + t;
            else terms.push(t);
         }
         else terms.push(t); // Intermediate terms
         return terms;
      }, []);
      return terms;
   }

   /* -------------------------------------------- */

   /**
    * Split a formula by identifying arithmetic terms
    * @param {string} _formula                 The raw formula to split
    * @returns {Array<(string|OperatorTerm)>}  An array of terms, split on arithmetic operators
    * @private
    */
   static _splitOperators(_formula) {
      let { formula, flavors } = this._extractFlavors(_formula);
      const parts = formula.replace(OperatorTerm.REGEXP, ";$&;").split(";");
      return parts.reduce((terms, t) => {
         t = t.trim();
         if (!t) return terms;
         const isOperator = OperatorTerm.OPERATORS.includes(t)
         terms.push(isOperator ? new OperatorTerm({ operator: t }) : this._restoreFlavor(t, flavors));
         return terms;
      }, []);
   }

   /* -------------------------------------------- */

   /**
    * Temporarily remove flavor text from a string formula allowing it to be accurately parsed.
    * @param {string} formula                        The formula to extract
    * @returns {{formula: string, flavors: object}}  The cleaned formula and extracted flavor mapping
    * @private
    */
   static _extractFlavors(formula) {
      const flavors = {};
      let fn = 0;
      formula = formula.replace(RollTerm.FLAVOR_REGEXP, flavor => {
         let key = `%F${fn++}%`;
         flavors[key] = flavor;
         return key;
      });
      return { formula, flavors };
   }

   /* -------------------------------------------- */

   /**
    * Restore flavor text to a string term
    * @param {string} term         The string term possibly containing flavor symbols
    * @param {object} flavors      The extracted flavors object
    * @returns {string}            The restored term containing flavor text
    * @private
    */
   static _restoreFlavor(term, flavors) {
      for (let [key, flavor] of Object.entries(flavors)) {
         if (term.indexOf(key) !== -1) {
            delete flavors[key];
            term = term.replace(key, flavor);
         }
      }
      return term;
   }

   /* -------------------------------------------- */

   /**
    * Classify a remaining string term into a recognized RollTerm class
    * @param {string} term         A remaining un-classified string
    * @param {object} [options={}] Options which customize classification
    * @param {boolean} [options.intermediate=false]  Allow intermediate terms
    * @param {RollTerm|string} [options.prior]       The prior classified term
    * @param {RollTerm|string} [options.next]        The next term to classify
    * @returns {RollTerm}          A classified RollTerm instance
    * @private
    */
   static _classifyStringTerm(term, { intermediate = true, prior, next } = {}) {

      // Terms already classified
      if (term instanceof RollTerm) return term;

      // Numeric terms
      const numericMatch = NumericTerm.matchTerm(term);
      if (numericMatch) return NumericTerm.fromMatch(numericMatch);

      // Dice terms
      const diceMatch = DiceTerm.matchTerm(term, { imputeNumber: !intermediate });

      if (diceMatch) {
         if (intermediate && (prior?.isIntermediate || next?.isIntermediate)) return new StringTerm({ term });
         return DiceTerm.fromMatch(diceMatch);
      } else {
         // default match failed, try matching terms of the form 4d
         let swMatch = term.match(/^([0-9]+)?[dD]([^ (){}[\]+\-*/]+)?(?:\[([^\]]+)\])?$/)
         if (swMatch) {
            return new Die({ number: parseInt(swMatch[1]), faces: 6, options: { sw: true } })
         }
      }

      // Remaining strings
      return new StringTerm({ term });
   }

   /* -------------------------------------------- */
   /*  Chat Messages                               */
   /* -------------------------------------------- */

   /**
    * Render the tooltip HTML for a Roll instance
    * @return {Promise<string>}      The rendered HTML tooltip as a string
    */
   async getTooltip() {
      const parts = this.dice.map(d => d.getTooltipData());
      return renderTemplate(this.constructor.TOOLTIP_TEMPLATE, { parts });
   }

   /* -------------------------------------------- */

   /**
    * Render a Roll instance to HTML
    * @param {object} [chatOptions]      An object configuring the behavior of the resulting chat message.
    * @return {Promise<string>}          The rendered HTML template as a string
    */
   async render(chatOptions = {}) {
      chatOptions = foundry.utils.mergeObject({
         user: game.user.id,
         flavor: null,
         template: this.constructor.CHAT_TEMPLATE,
         blind: false
      }, chatOptions);
      const isPrivate = chatOptions.isPrivate;

      // Execute the roll, if needed
      if (!this._evaluated) this.evaluate();

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
    * @param {string} [options.rollMode]   The template roll mode to use for the message from CONFIG.Dice.rollModes
    * @param {boolean} [options.create=true]   Whether to automatically create the chat message, or only return the
    *                                          prepared chatData object.
    * @return {Promise<ChatMessage>}       A promise which resolves to the created ChatMessage entity, if create is true
    *                                      or the Object of prepared chatData otherwise.
    */
   async toMessage(messageData = {}, { rollMode, create = true } = {}) {

      // Perform the roll, if it has not yet been rolled
      if (!this._evaluated) await this.evaluate({ async: true });

      // Prepare chat data
      messageData = foundry.utils.mergeObject({
         user: game.user.id,
         type: CONST.CHAT_MESSAGE_TYPES.ROLL,
         content: this.total,
         sound: CONFIG.sounds.dice,
      }, messageData);
      messageData.roll = this;

      // Either create the message or just return the chat data
      const cls = getDocumentClass("ChatMessage");
      const msg = new cls(messageData);
      if (rollMode) msg.applyRollMode(rollMode);

      // Either create or return the data
      if (create) return cls.create(msg.data);
      else return msg.data;
   }

   /* -------------------------------------------- */
   /*  Interface Helpers                           */
   /* -------------------------------------------- */

   /**
    * Expand an inline roll element to display it's contained dice result as a tooltip
    * @param {HTMLAnchorElement} a     The inline-roll button
    * @return {Promise<void>}
    */
   static async expandInlineResult(a) {
      if (!a.classList.contains("inline-roll")) return;
      if (a.classList.contains("expanded")) return;

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
    */
   static collapseInlineResult(a) {
      if (!a.classList.contains("inline-roll")) return;
      if (!a.classList.contains("expanded")) return;
      const tooltip = a.querySelector(".dice-tooltip");
      if (tooltip) tooltip.remove();
      return a.classList.remove("expanded");
   }

   /* -------------------------------------------- */
   /*  Serialization and Loading                   */
   /* -------------------------------------------- */

   /**
    * Represent the data of the Roll as an object suitable for JSON serialization.
    * @return {Object}     Structured data which can be serialized into JSON
    */
   toJSON() {
      return {
         class: this.constructor.name,
         options: this.options,
         dice: this._dice,
         formula: this._formula,
         terms: this.terms,
         total: this._total,
         evaluated: this._evaluated
      }
   }

   /* -------------------------------------------- */

   /**
    * Recreate a Roll instance using a provided data object
    * @param {object} data   Unpacked data representing the Roll
    * @return {Roll}         A reconstructed Roll instance
    */
   static fromData(data) {

      // Create the Roll instance
      const roll = new this(data.formula, data.data, data.options);

      // Expand terms
      roll.terms = data.terms.map(t => {
         if (t.class) {
            if (t.class === "DicePool") t.class = "PoolTerm"; // backwards compatibility
            return RollTerm.fromData(t);
         }
         return t;
      });

      // Repopulate evaluated state
      if (data.evaluated ?? true) {
         roll._total = data.total;
         roll._dice = (data.dice || []).map(t => DiceTerm.fromData(t));
         roll._evaluated = true;
      }
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
      if (!cls) throw new Error(`Unable to recreate ${data.class} instance from provided data`);
      return cls.fromData(data);
   }

   /* -------------------------------------------- */

   /**
    * Manually construct a Roll object by providing an explicit set of input terms
    * @param {RollTerm[]} terms      The array of terms to use as the basis for the Roll
    * @param {object} [options={}]   Additional options passed to the Roll constructor
    * @returns {Roll}                The constructed Roll instance
    *
    * @example
    * const t1 = new Die({number: 4, faces: 8};
    * const plus = new OperatorTerm({operator: "+"});
    * const t2 = new NumericTerm({number: 8});
    * const roll = Roll.fromTerms([t1, plus, t2]);
    * roll.formula; // 4d8 + 8
    */
   static fromTerms(terms, options = {}) {

      // Validate provided terms
      if (!terms.every(t => t instanceof RollTerm)) {
         throw new Error("All provided terms must be RollTerm instances");
      }
      const allEvaluated = terms.every(t => t._evaluated);
      const noneEvaluated = !terms.some(t => t._evaluated);
      if (!(allEvaluated || noneEvaluated)) {
         throw new Error("You can only call Roll.fromTerms with an array of terms which are either all evaluated, or none evaluated");
      }

      // Construct the roll
      const formula = this.getFormula(terms);
      const roll = this.create(formula, {}, options);
      roll.terms = terms;
      roll._evaluated = allEvaluated;
      if (roll._evaluated) roll._total = roll._evaluateTotal();
      return roll;
   }

   /* -------------------------------------------- */
   /*  Deprecations                                */
   /* -------------------------------------------- */

   /**
    * @deprecated since 0.8.1
    * @ignore
    */
   get _rolled() {
      console.warn("You are referencing Roll#_rolled which is deprecated in favor of Roll#_evaluated")
      return this._evaluated;
   }
}