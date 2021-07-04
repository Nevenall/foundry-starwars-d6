import CharacterSheet from './character-sheet.js'
import Character from './character.js'
import Roll from './custom-roll.js'


Hooks.once('init', async function () {
   console.log('a long time ago in a galaxy far far away...')

   //CONFIG.debug.hooks = true
   CONFIG.debug.dice = true

   CONFIG.Actor.documentClass = Character

   CONFIG.Dice.rolls[0] = Roll

   // Register sheet application classes
   Actors.unregisterSheet("core", ActorSheet)
   Actors.registerSheet("starwars-d6", CharacterSheet, {
      makeDefault: true
   })

   game.socket.on("system.starwars-d6", data => {
      // console.log(data)
   })
})

Hooks.once('ready', async () => {

})


Hooks.on("renderChatMessage", async (app, html, data) => {

})