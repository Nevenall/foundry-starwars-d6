/**
 * A system to create any RPG ruleset without needing to code
 * Author: Seregras
 * Software License: GNU GPLv3
 */

// Import Modules
import { gActorSheet } from "./gactorsheet.js";
import { sItemSheet } from "./sitemsheet.js";
import { gActor } from "./a-entity.js";
import { gItem } from "./i-entity.js";
import { SBOX } from "./config.js";
import { auxMeth } from "./auxmeth.js";

/* -------------------------------------------- */
/*  Hooks                 */
/* -------------------------------------------- */

Hooks.once("init", async function() {
    console.log(`Initializing Sandbox System`);

    /**
	 * Set an initiative formula for the system
	 * @type {String}
	 */
    CONFIG.Combat.initiative = {
        formula: "1d20",
        decimals: 2
    };

    CONFIG.debug.hooks = true;
    CONFIG.Actor.entityClass = gActor;
    CONFIG.Item.entityClass = gItem;

    auxMeth.buildSheetHML();
    auxMeth.registerIfHelper();
    auxMeth.registerIfNotHelper();
    auxMeth.registerIfGreaterHelper();
    auxMeth.registerIfLessHelper();
    auxMeth.registerIsGM();
    auxMeth.registerShowMod();

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("dnd5e", gActorSheet, { makeDefault: true });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("dnd5e", sItemSheet, {makeDefault: true});

    game.settings.register("sandbox", "showADV", {
        name: "Show Roll with Advantage option",
        hint: "If checked, 1d20,ADV,DIS options will be displayed under the Actor's name",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

    game.settings.register("sandbox", "showSimpleRoller", {
        name: "Show d20 Roll icon option",
        hint: "If checked a d20 icon will be displayed under the Actor's name",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

    game.settings.register("sandbox", "showDC", {
        name: "Show DC window",
        hint: "If checked a DC box will appear at the bottom of the screen",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

    game.settings.register("sandbox", "showLastRoll", {
        name: "Show Last Roll window",
        hint: "If checked a box displaying the results of the last Roll will appear at the bottom of the screen",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

});

Hooks.once('ready', async() => {
    //console.log("ready!");

    //Gets current sheets
    await auxMeth.getSheets();

    //GM ROLL MENU TEMPLATE
    //Sets roll menu close to hotbar THIS IS SOMETHING FOR ME STREAMS, TO REMOVE IF YOU LIKE

    if(game.user.isGM){

        let hotbar = document.getElementById("hotbar");
        let backgr = document.createElement("DIV");
        backgr.className = "dc-input";

        let header = document.createElement("DIV");
        header.className = "dc-header";
        header.textContent = "DC";

        let form = document.createElement("FORM");
        let sInput = document.createElement("INPUT");
        sInput.setAttribute("type", "text");
        sInput.setAttribute("name", "dc");
        sInput.setAttribute("value", "");

        let initvalue = 0;
        if(!hasProperty(SBOX.diff,game.data.world.name)){
            setProperty(SBOX.diff,game.data.world.name,0);
        }

        sInput.value = SBOX.diff[game.data.world.name];

        sInput.addEventListener("keydown", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if(event.key=="Backspace" || event.key=="Delete"){
                sInput.value = "";
            }

            else if(event.key=="Enter"){
                SBOX.diff[game.data.world.name] = sInput.value;
            }

            else{
                if(!isNaN(event.key))
                    sInput.value += event.key;
            }

        });

        sInput.addEventListener("focusout", (event) => {
            event.preventDefault();
            event.stopPropagation();

            SBOX.diff[game.data.world.name] = sInput.value;

        });

        form.appendChild(sInput);
        backgr.appendChild(header);

        backgr.appendChild(form);

        if(game.settings.get("sandbox", "showDC"))
            await hotbar.appendChild(backgr);

        await auxMeth.rollToMenu();
        SBOX.showshield = false;

        document.addEventListener("keydown", (event) => {
            if(event.key=="Control"){
                SBOX.showshield = true;
            }

        });

        document.addEventListener("keyup", (event) => {
            SBOX.showshield = false;

        });

        let macrosheet = document.getElementById("hotbar");

    }

});

//COPIED FROM A MODULE. TO SHOW A SHIELD ON A TOKEN AND LINK THE ATTRIBUTE. TO REMOVE
Hooks.on("hoverToken", (token, hovered) => {

    if(token.actor==null)
        return;

    if(token.actor.data.data.tokenshield == null)
        return;

    let shieldprop = token.actor.data.data.tokenshield;
    //console.log(shieldprop);

    let ca = token.actor.data.data.attributes[shieldprop].value;

    let template = $(`
<div class="section">
<div class="value"><i class="fas fa-shield-alt"></i>${ca}</div>
</div>
`);

    if (hovered && SBOX.showshield) {
        let canvasToken = canvas.tokens.placeables.find((tok) => tok.id === token.data._id);
        let dmtktooltip = $(`<div class="dmtk-tooltip"></div>`);
        dmtktooltip.css('left', (canvasToken.worldTransform.tx + ((token.width) * canvas.scene._viewPosition.scale)) + 'px');
        dmtktooltip.css('top', (canvasToken.worldTransform.ty) + 'px');
        dmtktooltip.html(template);
        $('body.game').append(dmtktooltip);
    } else {
        $('.dmtk-tooltip').remove();
    }

});

Hooks.on("deleteToken", (scene, token) => {
    $('.dmtk-tooltip').remove();
});


Hooks.on("preUpdateActor", async (data, updateData) => {

    //console.log(updateData);
    if(updateData.name){
        //data.data.token.name = updateData.name;
    }

    if(updateData.data){
        if(updateData.data.displayName){
            data.data.token.displayName = updateData.data.displayName;
            data.data.token.displayBars = updateData.data.displayName;
        }
        if(updateData.data.tokenbar1){
            data.data.token.bar1.attribute = updateData.data.tokenbar1;
        }
    }

    if(updateData.img){
        updateData["token.img"] = updateData.img;
        data.data.token.img = updateData.img;
    }



});

Hooks.on("preCreateToken", async (scene, tokenData, options, userId) =>{
    //console.log(tokenData);

    const sameTokens = game.scenes.get(scene.id).data.tokens.filter(e => e.actorId === tokenData.actorId) || [];
    let tokennumber = 0;
    if (sameTokens.length !== 0) { 
        tokennumber = sameTokens.length + 1;
    }

    if(tokennumber!=0){
        tokenData.name += " " + tokennumber;
    }

});

Hooks.on('createCombatant', (combat, combatantId, options) => {
    combatantId.initiative=1;
});

Hooks.on("preCreateActor", (createData) =>{
    if(createData.token!=null)
        createData.token.name = createData.name;

});

Hooks.on("deleteActor", (actor) =>{
    //console.log(actor);

});

Hooks.on("updateActor", async (actor, updateData,options,userId) => {

    //console.log(actor);
    //console.log(updateData);
    if(updateData){

        actor.data.flags.lastupdatedBy = await userId;
        //actor.data.flags.haschanged = true;
    }
    else{
        //actor.data.flags.haschanged = false;
        //console.log("not changed");
    }

    if(actor.data.token.name!=actor.data.name){
        actor.data.token.name = actor.data.name;
        actor.data.token.displayName = actor.data.data.displayName;
        actor.data.token.displayBars = actor.data.data.displayName;
        actor.data.token.bar1.attribute = actor.data.data.tokenbar1;
        actor.update({"token":actor.data.token},{diff:false});
    }

    //console.log("updated");

});

Hooks.on("closegActorSheet", (entity, eventData) => {
    //console.log(entity);
    //console.log("closing");
    let character = entity.object.data;
    if(character.flags.ischeckingauto)
        character.flags.ischeckingauto=false;

    //entity.object.update({"token":entity.object.data.token},{diff:false});


});

Hooks.on("createItem", (entity) => {
    let do_update=false;
    if(entity.type=="cItem"){
        //console.log(entity);
        for(let i=0;i<entity.data.data.mods.length;i++){
            const mymod=entity.data.data.mods[i];
            if(mymod.citem!=entity.data._id){
                mymod.citem = entity.data._id;
                do_update=true;
            }

        }
        if(do_update)
            entity.update();
    }
});

Hooks.on("updateItem", (entity) => {

    let do_update=false;
    if(entity.type=="cItem"){
        //console.log(entity);
        for(let i=0;i<entity.data.data.mods.length;i++){
            const mymod=entity.data.data.mods[i];
            if(mymod.citem!=entity.data._id){
                mymod.citem = entity.data._id;
                do_update=true;
            }

        }
        if(do_update)
            entity.update();
    }
});

Hooks.on("closesItemSheet", (entity, eventData) => {
    let item = entity.object.data;
    //console.log("closing");
    setProperty(item.flags,"rerender",true);

});

Hooks.on("rendersItemSheet", (app, html, data) => {
    //console.log(html[0].outerHTML);

    if(app.object.data.type == "cItem"){
        app.refreshCIAttributes(html);
    }

    app.scrollBarTest(html);

    html.find('.window-resizable-handle').mouseup(ev => {
        event.preventDefault();
        app.scrollBarTest(html);
    });

});

Hooks.on("rendergActorSheet", async (app, html, data) => {
    const actor = app.actor;
    let _html = await app.getTemplateHTML(html);

    if(actor.data.data.istemplate && hasProperty(actor.data.data,"_html")){
        html = actor.data.data._html;
    }
    else{
        html = $(_html);
    }

    if(actor.data.flags.lastupdatedBy==null){
        actor.data.flags.lastupdatedBy = game.user._id;
        actor.data.flags.haschanged = true;
    }

    if(actor.data.flags.lastupdatedBy == game.user._id && actor.data.flags.haschanged){
        if(!app.actor.data.flags.ischeckingauto)
            app.actor.actorUpdater(data);

    }

    actor.listSheets();
    if(!actor.data.data.istemplate){
        app.refreshCItems(html);
        app.handleGMinputs(html);
        app.refreshBadge(html);
        app.populateRadioInputs(html);
        app.scrollBarTest(html);
        actor.setInputColor();

        html.find('.window-resizable-handle').mouseup(ev => {
            event.preventDefault();
            app.scrollBarTest(html);
        });
    }

    app.displaceTabs();



});

Hooks.on("renderChatMessage", async (app, html, data) => {
    let messageId = app.data._id;
    let msg = game.messages.get(messageId);
    let msgIndex = game.messages.entities.indexOf(msg);

    let header = $(html).find(".message-header");
    header.remove();
    //console.log("tirando");
    let detail = $(html).find(".roll-detail")[0];
    if(detail==null)
        return;

    let detaildisplay = detail.style.display;
    detail.style.display = "none";
    let result = $(html).find(".roll-result")[0];
    let resultdisplay = result.style.display;

    let clickdetail = $(html).find(".roll-detail-button")[0];
    let clickdetaildisplay = clickdetail.style.display;
    let clickmain = $(html).find(".roll-main-button")[0];
    let clickmaindisplay = clickmain.style.display;
    clickmain.style.display = "none";

    $(html).find(".roll-detail-button").click(ev => {
        detail.style.display = detaildisplay;
        result.style.display = "none";
        $(html).find(".roll-detail-button").hide();
        $(html).find(".roll-main-button").show();
    });

    $(html).find(".roll-main-button").click(ev => {
        result.style.display = resultdisplay;
        detail.style.display = "none";
        $(html).find(".roll-detail-button").show();
        $(html).find(".roll-main-button").hide();
    });



    if(game.user.isGM){
        $(html).find(".roll-message-delete").click(async ev => {
            msg.delete();
        });
        auxMeth.rollToMenu();
    }


});

Hooks.on("renderDialog",(app,html,data)=>{
    const htmlDom = html[0];

    if (app.data.citemdialog){

        let checkbtns = htmlDom.getElementsByClassName("dialog-check");
        let dialogDiv = htmlDom.getElementsByClassName("item-dialog");
        let button = htmlDom.getElementsByClassName("dialog-button")[0];

        let actorId = dialogDiv[0].getAttribute("actorId");
        let selectnum = dialogDiv[0].getAttribute("selectnum");
        const actor = game.actors.get(actorId);
        setProperty(actor.data.flags,"selection",[]);
        button.disabled=true;

        for(let i=0;i<checkbtns.length;i++){
            let check = checkbtns[i];
            check.addEventListener("change", (event) => {

                let itemId = event.target.getAttribute("itemId");
                if(event.target.checked){
                    actor.data.flags.selection.push(itemId);
                }

                else{
                    actor.data.flags.selection.splice(actor.data.flags.selection.indexOf(itemId),1);
                }

                let selected = actor.data.flags.selection.length;

                if(selected!=selectnum){
                    button.disabled=true;
                }
                else{
                    button.disabled=false;
                }

            });
        }
    }

    if(app.data.citemText){

        htmlDom.addEventListener("keydown", function (event) {
            event.stopPropagation();
        }, true);

        let t_area = htmlDom.getElementsByClassName("texteditor-large");
        //console.log(t_area);
        t_area[0].addEventListener("change", (event) => {
            app.data.dialogValue = event.target.value;

        });
    }
});


