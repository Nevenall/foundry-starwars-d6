/**
 * Define a three-sided Fate/Fudge dice term that can be used as part of a Roll formula
 * Mathematically behaves like 1d3-2
 * @extends {DiceTerm}
 */
class FateDie extends DiceTerm {
   constructor(termData) {
     super(termData);
     this.faces = 3;
   }
 
   /* -------------------------------------------- */
 
   /** @override */
   roll(options) {
     const roll = super.roll(options);
     roll.result = roll.result - 2;
     this.results[this.results.length - 1].result = roll.result;
     return roll;
   }
 
   /* -------------------------------------------- */
 
   /** @override */
   static getResultLabel(result) {
     return {
       "-1": "-",
       "0": "&nbsp;",
       "1": "+"
     }[result];
   }
 }
 FateDie.DENOMINATION = "f";