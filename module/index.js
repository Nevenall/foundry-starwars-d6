import CharacterSheet from './character-sheet.js'
import Character from './character.js'
import Roll from './custom-roll.js'
import Die from './custom-die.js'


Hooks.once('init', async function () {
   console.log('a long time ago in a galaxy far far away...')

   // CONFIG.debug.hooks = true
   CONFIG.Actor.entityClass = Character

   CONFIG.Dice.rolls[0] = Roll
   CONFIG.Dice.terms[''] = Die

   // add a new kind of dice for character points
   // CONFIG.Dice.types.push(CharacterPointDie)
   // CONFIG.Dice.terms.push({"cp": })


   // debug - not totally sure what this does :)
   game.debug = true

   // Register sheet application classes
   Actors.unregisterSheet("core", ActorSheet)
   Actors.registerSheet("starwars-d6", CharacterSheet, {
      makeDefault: true
   })


   game.socket.on("system.starwars-d6", data => {
      // if (data.op === 'target_edit') {
      //    Character.handleTargetRequest(data)
      // }
   })


})

Hooks.once('ready', async () => {

})


Hooks.on("renderChatMessage", async (app, html, data) => {


})