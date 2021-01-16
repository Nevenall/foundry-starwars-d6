

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class CharacterSheet extends ActorSheet {

   /** @override */
   static get defaultOptions() {
      return mergeObject(super.defaultOptions, {
         classes: ["starwars-d6", "sheet", "actor"],
         width: 650,
         height: 600
      });
   }


   /** @override */
   async getData() {
      const data = super.getData();
      return data;
   }


   /** @override */
   activateListeners(html) {
      //console.log(html);
      super.activateListeners(html);

   }


   async _updateObject(event, formData) {
     

      await super._updateObject(event, formData);

   }


}