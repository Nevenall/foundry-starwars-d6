import {
   CharacterSheet
} from './character-sheet.js'
import {
   Character
} from './character.js'



Hooks.once('init', async function () {
   console.log('a long time ago in a galaxy far far away...')

   CONFIG.debug.hooks = true
   CONFIG.Actor.entityClass = Character

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