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

}