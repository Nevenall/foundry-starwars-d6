
/// a custom die class for games which exclusively use d6. Allows for dice formula which don't specify the number of faces. For example: 3d or 3D will roll 3d6
export default class WildDie extends CustomDie {

   constructor(termData) {
      super(termData)
   }


   /**
    * Check if the expression matches this type of term
    * @param {string} expression               The expression to parse
    * @param {boolean} [imputeNumber=false]     Allow the number of dice to be optional, i.e. "d6"
    * @return {RegExpMatchArray|null}
    */
   static matchTerm(expression, { imputeNumber = false } = {}) {
      const rgx = new RegExp(`^([0-9]+)${imputeNumber ? "?" : ""}[dD]([A-z]|[0-9]*)${DiceTerm.MODIFIERS_REGEX}${DiceTerm.FLAVOR_TEXT_REGEX}`)
      const match = expression.match(rgx)
      return match || null
   }

   /**
    * Parse a provided roll term expression, identifying whether it matches this type of term.
    * @param {string} expression
    * @param {object} options            Additional term options
    * @return {DiceTerm|null}            The constructed DiceTerm instance
    */
   static fromExpression(expression, options = {}) {
      const match = this.matchTerm(expression)
      if (!match) return null
      let [number, denomination, modifiers, flavor] = match.slice(1)

      // if no denomination was present, we should mark this term for adding wild die
      if (denomination === '') {
         options.shouldAddWildDie = true
      }

      // Get the denomination of DiceTerm
      denomination = denomination.toLowerCase()
      const term = denomination in CONFIG.Dice.terms ? CONFIG.Dice.terms[denomination] : Die
      if (!term) throw new Error(`Die denomination ${denomination} not registered in CONFIG.Dice.terms`)

      // Get the term arguments
      number = Number.isNumeric(number) ? parseInt(number) : 1
      const faces = Number.isNumeric(denomination) ? parseInt(denomination) : 6
      modifiers = Array.from((modifiers || "").matchAll(DiceTerm.MODIFIER_REGEX)).map(m => m[0])
      if (flavor) options.flavor = flavor

      if (modifiers.length > 0) {
         // if there are modifiers, don't flag for wild die
         options.shouldAddWildDie = false
      }

      // Construct a term of the appropriate denomination
      return new term({
         number,
         faces,
         modifiers,
         options
      })
   }


}