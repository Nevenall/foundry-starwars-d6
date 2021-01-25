import CustomDie from './custom-die.js'

/// Implement a custom Roll class to handle rolling the wild die.
export default class CustomRoll extends Roll {
   constructor(formula, data = {}) {
      super(formula, data = {})
   }

   _identifyTerms(formula, { step = 0 } = {}) {

      if (typeof formula !== "string") throw new Error("The formula provided to a Roll instance must be a string")

      // Step 1 - Update the Roll formula using provided data
      formula = this.constructor.replaceFormulaData(formula, this.data, { missing: "0", warn: true })

      // Step 2 - identify separate parenthetical terms
      let terms = this._splitParentheticalTerms(formula)

      // Step 3 - expand pooled terms
      terms = this._splitPooledTerms(terms)

      // Step 4 - expand remaining arithmetic terms
      terms = this._splitDiceTerms(terms, step)

      // Step 4.1 - if the formula leaves off the 6 (ie '2d') turn one of the dice into a wild die.
      terms = this._customHandling(terms, step)

      // Step 5 - clean and de-dupe terms
      terms = this.constructor.cleanTerms(terms)

      return terms
   }


   /// override to use our custom DieTerm for parsing instead of the default static functions.
   _splitDiceTerms(terms, step) {

      // Split on arithmetic terms and operators
      const operators = this.constructor.ARITHMETIC.concat(["(", ")"])
      const arith = new RegExp(operators.map(o => "\\" + o).join("|"), "g")

      // Expand remaining string terms by splitting on arithmetic operators
      terms = terms.reduce((arr, term) => {
         if (typeof term === "string") {
            const split = term.replace(arith, ";$&;").split(";")
            for (let s of split) {
               s = s.trim()
               if (s !== "") arr.push(s)
            }
         }
         else arr.push(term)
         return arr
      }, [])

      // Iterate over all terms, identifying numeric and dice terms
      terms = terms.reduce((arr, term, i, terms) => {

         // Preserve existing object types
         if (getType(term) === "Object") {
            arr.push(term)
            return arr
         }

         // Handle arithmetic terms
         if (this.constructor.ARITHMETIC.includes(term)) {
            if (!arr.length && (term !== "-")) return arr // Ignore leading arithmetic except negatives
            else if (i === (terms.length - 1)) return arr // Ignore trailing arithmetic
            arr.push(term)
            return arr
         }

         // Handle numeric terms
         if (Number.isNumeric(term)) {
            arr.push(Number(term))
            return arr
         }

         // Identify Dice terms
         if (CustomDie.matchTerm(term, { imputeNumber: step > 0 })) {
            const die = CustomDie.fromExpression(term)
            arr.push(die)
            return arr
         }

         // Remaining string terms
         arr.push(term)
         return arr
      }, [])

      // Return the set of final terms
      return terms
   }


   _customHandling(terms, steps) {
      if (steps > 0) { return terms }
      let shouldAddWildDie = terms.some(el => el && el.options ? el.options.shouldAddWildDie : false)

      for (let i = 0; i < terms.length; i++) {
         const el = terms[i]
         if (!el || el._evaluated) { continue }

         if (el === '+' || el === '-') {
            let left = terms[i - 1]
            let right = terms[i + 1]

            if (left.options && left.options.shouldAddWildDie && right.options && right.options.shouldAddWildDie) {
               // splice these 3 elements with one combined by evaluating the operations
               // in doing so the wild die flag is intentionally lost
               if (el === '+') {
                  terms.splice(i - 1, 3, new CustomDie({ number: left.number + right.number, faces: 6, options: { ...left.options, ...right.options } }))
               } else if (el === '-') {
                  terms.splice(i - 1, 3, new CustomDie({ number: left.number - right.number, faces: 6, options: { ...left.options, ...right.options } }))
               }
               --i
            }
         }
      }

      if (shouldAddWildDie) {
         let collectedDice = terms.find(el => el.options ? el.options.shouldAddWildDie : false)
         if (collectedDice.number > 0) {
            collectedDice.number--
            collectedDice.options.shouldAddWildDie = false
            collectedDice.options.collectedDice = true
            let wildDie = new CustomDie({ number: 1, faces: 6, modifiers: ['x'], options: { isWildDie: true, flavor: 'wild_die', shouldAddWildDie: false } })
            terms.unshift(wildDie, '+')
         }
      }

      return terms
   }

   evaluate({ minimize = false, maximize = false } = {}) {
      if (this._rolled) throw new Error("This Roll object has already been rolled.");

      // Step 1 - evaluate any inner Rolls and recompile the formula
      let hasInner = false;
      this.terms = this.terms.map((t, i, terms) => {
         if (t instanceof Roll) {
            hasInner = true;
            t.evaluate({ minimize, maximize });
            this._dice = this._dice.concat(t.dice);
            const priorMath = (i > 0) && (terms[i - 1].split(" ").pop() in Math);
            return priorMath ? `(${t.total})` : String(t.total);
         }
         return t;
      });

      // Step 2 - re-compile the formula and re-identify terms
      const formula = this.constructor.cleanFormula(this.terms);
      this.terms = this._identifyTerms(formula, { step: 1 });

      // Step 3 - evaluate remaining terms
      this.results = this.terms.map((term, i, arr) => {
         if (term.evaluate) {
            let total = term.evaluate({ minimize, maximize }).total
            if (term.options.flavor === 'wild_die' && total === 1) {
               // todo - some day we'll figure out how to change the roll parameters of the rest of our dice to dh1 because of the 1 on the wild die.
               //
               console.log("you rolled a one on your wild die")
            }
            return total
         } else {
            return term
         }

      });

      // Step 4 - safely evaluate the final total
      let total = this._safeEval(this.results.join(" "));
      if (total === null) total = 0;
      if (!Number.isNumeric(total)) {
         throw new Error(game.i18n.format("DICE.ErrorNonNumeric", { formula: this.formula }));
      }

      // Store final outputs
      this._total = total;
      this._rolled = true;
      return this;
   }

}