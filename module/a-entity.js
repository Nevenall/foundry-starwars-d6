import { SBOX } from "./config.js";
import { auxMeth } from "./auxmeth.js";

export class gActor extends Actor{

    prepareData(){     
        super.prepareData();

        // Get the Actor's data object
        const actorData = this.data;
        const data = actorData.data;
        const flags = actorData.flags;

        if (!hasProperty(flags, "ischeckingauto")){
            setProperty(flags,"ischeckingauto", false);
        }

        if (!hasProperty(flags, "scrolls")){
            setProperty(flags,"scrolls", {});
        }

        // Prepare Character data
        //console.log("preparing data");
        if(data.istemplate){

            if (!hasProperty(flags, "tabarray")){
                setProperty(flags,"tabarray", []);
            }

            if (!hasProperty(flags, "rows")){
                setProperty(flags,"rows", 0);
                setProperty(flags,"rwidth", 0);
            }


        }
        //console.log(this);

    }

    async listSheets(){

        await auxMeth.getSheets();

        //let charsheet = document.getElementById("actor-"+this._id);
        let charsheet;
        if(this.token==null){
            charsheet = document.getElementById("actor-"+this._id);
        }
        else{
            charsheet = document.getElementById("actor-"+this._id+"-"+this.token.data._id);
        }
        let sheets = charsheet.getElementsByClassName("selectsheet");

        if(sheets==null)
            return;

        let selector = sheets[0];

        if(selector==null)
            return;

        var length = selector.options.length;

        for (let j = length-1; j >= 0; j--) {
            selector.options[j] = null;
        }

        for(let k=0;k<SBOX.templates.length;k++){
            var opt = document.createElement('option');
            opt.appendChild( document.createTextNode(SBOX.templates[k]) );
            opt.value = SBOX.templates[k];
            selector.appendChild(opt);
        }

        selector.value = this.data.data.gtemplate;
    }

    //Overrides update method
    async update(data, options={}) {

        //console.log("updating");
        // Get the Actor's data object
        //const actorData = await this.data;
        //console.log(this.data.token.actorData);
        //console.log(this);
        if(this.token==null){
            return await super.update(data, options);
        }
        //
        else{
            //return await this.token.actor.update(data,options);
            //            console.log(this.data);
            this.data.flags.lastupdatedBy = game.user._id;

            if(!this.data.flags.ischeckingauto){
                await this.token.update({"actorData.data.citems":this.data.data.citems});
                return await super.update(data, options);

            }
            await this.sheet.render(true);
            //console.log(this.token.data.actorData);

        }



    }

    async addcItem(ciTem,addedBy = null){
        const citems = this.data.data.citems;
        const attributes = this.data.data.attributes;
        let itemKey = "";
        let newItem={};
        //console.log(ciTem);
        setProperty(newItem,itemKey,{});
        newItem[itemKey].id=ciTem.data._id;
        newItem[itemKey].ikey=itemKey;
        newItem[itemKey].name=ciTem.data.name;  

        newItem[itemKey].number = 1;
        newItem[itemKey].isactive = false;
        newItem[itemKey].isreset = true;

        if(ciTem.data.data.isUnique){
            let groupID = ciTem.data.data.uniqueGID;
            for(let i=citems.length-1;i>=0;i--){
                let citemObj = game.items.get(citems[i].id);
                let hasgroup = citemObj.data.data.groups.some(y=>y.id==groupID);
                if(hasgroup){
                    await this.deletecItem(citems[i].id, true);
                    //await  citems.splice(i,1);
                }

            }
        }

        //newItem[itemKey].attributes = ciTem.data.data.attributes;
        //newItem[itemKey].attributes = {};
        newItem[itemKey].attributes = await duplicate(ciTem.data.data.attributes);
        newItem[itemKey].attributes.name = ciTem.data.name;
        newItem[itemKey].rolls = {};
        newItem[itemKey].lastroll = 0;

        newItem[itemKey].groups = ciTem.data.data.groups;
        newItem[itemKey].usetype = ciTem.data.data.usetype;
        newItem[itemKey].ispermanent = ciTem.data.data.ispermanent;
        newItem[itemKey].rechargable = ciTem.data.data.rechargable;
        let maxuses = ciTem.data.data.maxuses;
        if(isNaN(maxuses))
            maxuses = await auxMeth.autoParser(maxuses,attributes,ciTem.data.data.attributes,false);
        newItem[itemKey].maxuses = maxuses;
        newItem[itemKey].uses = parseInt(maxuses);
        newItem[itemKey].icon = ciTem.data.data.icon;
        newItem[itemKey].selfdestruct = ciTem.data.data.selfdestruct;
        newItem[itemKey].mods = [];
        for(let i=0;i<ciTem.data.data.mods.length;i++){
            let _mod = ciTem.data.data.mods[i];
            await newItem[itemKey].mods.push({
                index:_mod.index,
                citem: ciTem.data._id,
                once:_mod.once,
                exec:false,
                attribute:_mod.attribute,
                value:0
            });
        }


        newItem[itemKey].disabledmods = [];

        if(addedBy){
            newItem[itemKey].addedBy = addedBy;
        }

        citems.push(newItem[itemKey]);
        this.data.flags.haschanged = true;
        //console.log(newItem);

        if(this.token!=null){
            this.actorUpdater();
        }


    }

    async deletecItem(itemID, cascading=false){
        //get Item
        const attributes = this.data.data.attributes;
        let citems = this.data.data.citems;
        let toRemove = citems.find(y=>y.id==itemID);
        let remObj = game.items.get(itemID);

        if(remObj!=null){
            let toRemoveObj = remObj.data.data;

            //Remove values added to attributes
            let addsetmods = toRemoveObj.mods.filter(y => y.type=="ADD");
            for(let i=0;i<addsetmods.length;i++){
                let modID = addsetmods[i].index;
                const _basecitem = await citems.find(y=>y.id==itemID && y.mods.find(x=>x.index==modID));
                if(_basecitem!=null){
                    const _mod = await _basecitem.mods.find(x=>x.index==modID);

                    let myAtt = _mod.attribute;
                    let myAttValue = _mod.value;
                    let attProp = "value";

                    if(myAtt!=null){
                        if(myAtt.includes(".max")){
                            attProp="max";
                            myAtt = myAtt.replace(".max","");
                        }
                        const actorAtt = attributes[myAtt];

                        if(actorAtt!=null){
                            if(addsetmods[i].type=="ADD"){
                                let jumpmod = await this.checkModConditional(addsetmods[i]);
                                if(((toRemove.isactive && !toRemoveObj.ispermanent) || toRemoveObj.usetype=="PAS") && !jumpmod)
                                    actorAtt[attProp] -= myAttValue;
                            }
                        }

                    }
                }

            }

            let itemsadded = citems.filter(y=>y.addedBy==itemID);
            for(let j=0;j<itemsadded.length;j++){

                if(!toRemoveObj.ispermanent)
                    await this.deletecItem(itemsadded[j].id,true);
            }

        }

        citems.splice(citems.indexOf(toRemove),1);
        this.data.flags.haschanged = true;
        if(!cascading){
            await this.update({"data.citems":citems}, {diff: false});
            //console.log("User: " + game.user._id + " is updating actor: " + this.name);
        }

        if(this.token!=null){
            this.actorUpdater();
        }

    }

    async updateCItems(){
        const citems = this.data.data.citems;
        for(let i=0;i<citems.length;i++){
            let citem = citems[i];
            let citemTemplate = game.items.get(citems[i].id);

            if(citemTemplate!=null){
                for(let j=0;j<citemTemplate.data.data.groups.length;j++){
                    let groupID = citemTemplate.data.data.groups[j];
                    let group = game.items.get(groupID.id);

                    if(group!=null){
                        for(let y=0;y<group.data.data.properties.length;y++){
                            let property = group.data.data.properties[y];
                            if(property.isconstant && citem.attributes[property.ikey]){
                                //console.log(property.ikey);
                                if(citem.attributes[property.ikey].value != citemTemplate.data.data.attributes[property.ikey].value){
                                    citem.attributes[property.ikey].value = citemTemplate.data.data.attributes[property.ikey].value;
                                }
                            }
                        }
                    }


                }
            }

            else{
                citems.splice(citems.indexOf(citem),1);
            }



        }

    }

    async checkAttConsistency(mods){

        let attArray=[];
        const attributes = this.data.data.attributes;
        //console.log(data.attributes);

        for(let k=0;k<mods.length;k++){
            let mod = mods[k];
            if(!attArray.includes(mods.attribute) && mod.attribute!=""){
                let moat = mod.attribute.replace(".max","");
                await attArray.push(moat);
            }



        }
        //console.log(attArray);

        for(let i=0;i<attArray.length;i++){

            let attribute = attArray[i];
            let attID;
            //console.log(attribute);
            let propertypool = await game.items.filter(y=>y.data.type=="property" && y.data.data.attKey==attribute);
            let property = propertypool[0];

            if(property!=null){

                if(!hasProperty(attributes,attribute)){
                    //console.log("noatt");
                    await setProperty(attributes,attribute,{});
                }

                if(!hasProperty(attributes[attribute],"id")){

                    await setProperty(attributes[attribute],"id",property.data._id);
                    attID = property.data._id;

                }

                let defvalue = await auxMeth.autoParser(property.data.data.defvalue,attributes,null,false);

                if(!hasProperty(attributes[attribute],"value")){
                    //console.log("novalue");
                    await setProperty(attributes[attribute],"value",defvalue);
                }

                if(!hasProperty(attributes[attribute],"max")){
                    //console.log("nomax");
                    await setProperty(attributes[attribute],"max","");
                }

                if(!hasProperty(attributes[attribute],"prev")){
                    //console.log("noprev");
                    await setProperty(attributes[attribute],"prev",defvalue);
                }
            }

        }

        //console.log(attributes);

    }

    async getMods(){
        const citemIDs = this.data.data.citems;
        const attributes = this.data.data.attributes;
        let mods=[];
        let newcitem=false;
        let updatecItem=true;
        for(let n=0;n<citemIDs.length;n++){

            let ciID = citemIDs[n].id;
            let citemObjBase = await game.items.get(ciID);
            //console.log(citemObjBase);
            if(citemObjBase!=null){
                let citemObj = citemObjBase.data.data;

                for(let i=0;i<citemObj.mods.length;i++){
                    //                    if(user.isGM){
                    //                        if(citemObj.mods[i].citem!=ciID){
                    //                            citemObj.mods[i].citem = ciID;
                    //                            updatecItem=true;
                    //                        }
                    //                    }


                    //console.log(citemIDs[n].id + " " + citemIDs[n].name);
                    await mods.push(citemObj.mods[i]);
                }
            }

            //            if(updatecItem){
            //                citemObjBase.update({data:citemObjBase.data.data},{diff:false});
            //            }
            //            else{
            //                ui.notifications.warn("cItem " + citemIDs[n].name + "needs rebuild/recheck by the GM");
            //            }

        }

        //console.log(mods);

        //ADD CI ITEMS 
        const itemmods = mods.filter(y=>y.type=="ITEM");

        this.data.data.selector=false;
        for(let i=0;i<itemmods.length;i++){
            let mod = itemmods[i];
            let _citem = game.items.get(mod.citem).data.data;
            let citem = citemIDs.find(y=>y.id==mod.citem);
            let jumpmod=false;

            if(mod.condop!="NON" && mod.condop!=null){

                let condAtt = mod.condat;
                let condValue = parseInt(mod.condvalue);

                let attIntValue = parseInt(attributes[condAtt].value);

                //                console.log(mod.name);
                //                console.log(mod.condop + " " + condValue + " " + attIntValue);

                if(!isNaN(attIntValue) && !isNaN(condValue)){
                    if(mod.condop=="EQU"){
                        if(attIntValue!=condValue){
                            jumpmod=true;
                        }
                    }

                    else if(mod.condop=="HIH"){
                        if(attIntValue <= condValue){
                            jumpmod=true;
                        }
                    }

                    else if(mod.condop=="LOW"){
                        if(attIntValue >= condValue){
                            jumpmod=true;
                        }
                    }
                }

            }

            if(!jumpmod){
                if(mod.selectnum==0){
                    for(let k=0;k<mod.items.length;k++){

                        let itemtoadd = mod.items[k];
                        let toadd = game.items.get(itemtoadd.id);

                        let ispresent = citemIDs.some(y=>y.id==itemtoadd.id);

                        const _basecitem = await citemIDs.find(y=>y.id==mod.citem && y.mods.find(x=>x.index==mod.index));
                        const _mod = await _basecitem.mods.find(x=>x.index==mod.index);


                        if(_citem.usetype=="PAS" || citem.isactive){

                            if(!ispresent && !_mod.exec){
                                //console.log("adding " + toadd.name);
                                let newItem= game.items.get(itemtoadd.id);
                                await this.addcItem(newItem,mod.citem);
                                newcitem = true;
                                if(mod.once)
                                    _mod.exec = true;
                            }
                        }

                        else{
                            if(ispresent && !_citem.ispermanent){
                                newcitem = true;
                                let citemmod = citemIDs.find(y=>y.id==itemtoadd.id);
                                let cindex = citemIDs.indexOf(citemmod);
                                //console.log("deleting " + toadd.name);
                                await citemIDs.splice(cindex,1);
                                _mod.exec = false;
                            }
                        }

                    }
                }

                else{

                    let thiscitem = citemIDs.find(y=>y.id==mod.citem);

                    if(!hasProperty(thiscitem,"selection")){
                        setProperty(thiscitem,"selection",[]);
                    }

                    let selindex = thiscitem.selection.find(y=>y.index==mod.index);

                    if(selindex==null){
                        let newindex = {};
                        newindex.index = mod.index;
                        newindex.selected = false;
                        thiscitem.selection.push(newindex);
                        this.data.data.selector=true;
                    }

                    else{
                        if(!selindex.selected){
                            this.data.data.selector=true;
                        }
                    }

                }
            }
            //            else{
            //                let thiscitem = citemIDs.find(y=>y.id==mod.citem);
            //
            //                if(!hasProperty(thiscitem,"selection")){
            //                    let selindex = thiscitem.selection.find(y=>y.index==mod.index);
            //                    let delindex = thiscitem.selection.IndexOf(selindex);
            //
            //                    thiscitem.selection.splice(delindex,1);
            //                }
            //
            //
            //            }
        }

        //console.log(mods);

        if(newcitem){
            mods = await this.getMods(citemIDs);
        }

        return mods;
    }

    async setInputColor(){

        const citemIDs = this.data.data.citems;

        for(let j=0;j<citemIDs.length;j++){
            const mods = citemIDs[j].mods;
            if(mods!=null){
                for (let i=0;i<mods.length;i++){
                    if(mods[i].exec){
                        const thismod = mods[i];

                        let charsheet;
                        if(this.token==null){
                            charsheet = document.getElementById("actor-"+this._id);
                        }
                        else{
                            charsheet = document.getElementById("actor-"+this._id+"-"+this.token.data._id);
                        }

                        let attinput = charsheet.getElementsByClassName(thismod.attribute);

                        if (attinput[0]!=null){
                            if(parseInt(thismod.value)<0){
                                attinput[0].className += " input-red";
                            }
                            else{
                                attinput[0].className += " input-green";
                            }
                        }


                    }
                }
            }

        }




    }

    async checkModConditional(mod){
        const citemIDs = this.data.data.citems;
        const attributes = this.data.data.attributes;
        let condAtt = mod.condat;
        let jumpmod = false;
        //console.log(condAtt);

        let citem = citemIDs.find(y=>y.id==mod.citem);

        if (condAtt!=null && condAtt!=""){
            let condValue = await auxMeth.autoParser(mod.condvalue,attributes,citem.attributes,false);
            let attIntValue;
            if(condAtt.includes("#")){

                attIntValue = await auxMeth.autoParser(condAtt,attributes,citem.attributes,false);
            }

            else{
                if(attIntValue==false || attIntValue==true){
                    attIntValue = attributes[condAtt].value;
                }
                else{
                    if(!isNaN(attIntValue)){
                        attIntValue = parseInt(attributes[condAtt].value);
                    }
                    else{
                        attIntValue = attributes[condAtt].value;
                    }
                }



            }

            //console.log(condAtt + " " + attIntValue + " " + condValue);

            if(mod.condop=="EQU"){
                if(attIntValue.toString()!=mod.condvalue.toString()){
                    jumpmod=true;
                }
            }

            else if(mod.condop=="HIH"){
                if(!isNaN(attIntValue) && !isNaN(condValue)){
                    if(attIntValue<=condValue){
                        jumpmod=true;
                    }
                }

            }

            else if(mod.condop=="LOW"){
                if(!isNaN(attIntValue) && !isNaN(condValue))
                    if(attIntValue>=condValue){
                        jumpmod=true;
                    }
            }
        }


        //console.log(jumpmod);
        return jumpmod;
    }

    async checkPropAuto(actorData){
        console.log("checking auto properties");
        let newcitem = false;
        let newroll = false;
        let ithaschanged = false;

        const attributes = actorData.data.attributes;

        //        console.log(this.data.data.attributes);
        //        console.log(actorData);
        let attributearray = [];
        for(let attribute in attributes){
            let attdata = attributes[attribute];
            if(Array.isArray(attdata.value))
                attdata.value = attdata.value[0];
            //console.log(attdata.name + " " + attdata.value + " isset " + attdata.isset);
            setProperty(attdata,"isset",false);
            setProperty(attdata,"default",false);
            attributearray.push(attribute);
        }

        //CHECKING CI ITEMS
        const citemIDs = this.data.data.citems;
        let initlength =citemIDs.length;
        const mods = await this.getMods(citemIDs);
        if(initlength<citemIDs.length){
            newcitem=true;
            ithaschanged = true;
        }
        //console.log(mods);
        //console.log(attributes);

        await this.updateCItems();

        await this.checkAttConsistency(mods);

        const rolls = actorData.data.rolls;

        //CHECK DEFVALUES IF IS NOT AUTO!!
        for (let i=0;i<attributearray.length;i++){
            let attribute = attributearray[i];
            let attdata = attributes[attribute];
            let property = await game.items.get(actorData.data.attributes[attribute].id);
            const actorAtt = actorData.data.attributes[attribute];
            if(property!=null){
                if(property.data.data.defvalue!="" && actorAtt.value=="" && property.data.data.auto=="" && !property.data.data.defvalue.includes(".max}")){
                    //console.log("defaulting " + attribute);
                    let exprmode = false;
                    if(property.data.data.datatype == "simpletext" || property.data.data.datatype == "textarea")
                        exprmode = true;
                    let newValue = await auxMeth.autoParser(property.data.data.defvalue,attributes,null,exprmode);
                    //console.log("defaulting " + attribute + newValue);
                    if(actorAtt.value!=newValue)
                        ithaschanged = true;
                    actorAtt.value = newValue ;
                }
                //console.log(property.data.data);
                //TODO DEFVALUE PARA MAX
                if(property.data.data.automax!=null){
                    if(property.data.data.automax!=""){
                        //console.log(property.data.data.automax);
                        if(!hasProperty(attdata,"maxblocked"))
                            attdata.maxblocked = false;
                        if(!attdata.maxblocked){
                            actorAtt.max = await auxMeth.autoParser(property.data.data.automax,attributes,null,false);
                            //console.log(attribute +" max to " + actorAtt.max);
                        }

                    }
                }


                if(attdata.modmax)
                    attdata.maxblocked = true;

                if(actorAtt.max==null || actorAtt.max=="")
                    attdata.maxblocked = false;


            }
            //console.log(attribute + " isset " + actorAtt.isset);
            //actorAtt.isset = false;

        }

        //console.log(attributes);

        //CI SET MODS
        const setmods = mods.filter(y=>y.type=="SET");
        for(let i=0;i<setmods.length;i++){
            let mod = setmods[i];
            //console.log(mod);
            let modAtt = mod.attribute;
            let attProp = "value";
            let modvable = "modified";
            if(modAtt.includes(".max")){
                modAtt = modAtt.replace(".max","");
                attProp = "max";
                modvable = "modmax";
            }

            let jumpmod=false;
            if(mod.condop!="NON" && mod.condop!=null){
                jumpmod = await this.checkModConditional(mod);
            }

            if(hasProperty(attributes,modAtt)){
                let value =mod.value;
                let finalvalue =value;
                //console.log(mod.name + " " + mod.citem + " " + mod.index);

                let citem = citemIDs.find(y=>y.id==mod.citem);

                let _citem = game.items.get(mod.citem).data.data;

                if(isNaN(value)){
                    if(value.charAt(0)=="|"){
                        value = value.replace("|","");
                        finalvalue = await auxMeth.autoParser(value,attributes,citem.attributes,true,false,citem.number);
                    }
                    else{
                        finalvalue = await auxMeth.autoParser(value,attributes,citem.attributes,false,false,citem.number);
                    }
                }

                const myAtt = attributes[modAtt];
                //console.log(mod.name + " " + mod.citem + " " + mod.index);
                const _basecitem = await citemIDs.find(y=>y.id==mod.citem && y.mods.find(x=>x.index==mod.index));
                const _mod = await _basecitem.mods.find(x=>x.index==mod.index);

                if(_mod==null)
                    console.log(citem);
                if(_mod.exec)
                    myAtt.isset=true;

                //Checks if mod has not changed. TODO METHOD TO CHECK THIS AND MOD EXISTING
                if(_mod.exec && (_mod.value!=finalvalue || _mod.attribute!=modAtt)){
                    _mod.exec = false;
                }

                //console.log(mod.name + " exec= " + _mod.exec + " citem= " + citem.name + " active= " + citem.isactive + " value= " + finalvalue + " isset=" + myAtt.isset);
                if((_citem.usetype=="PAS" || citem.isactive) && !jumpmod){

                    if(attProp!="max" || (attProp=="max" && !myAtt.maxblocked)){
                        myAtt.prev= myAtt[attProp];
                        _mod.exec = true;
                        _mod.value=finalvalue;
                        _mod.attribute=mod.attribute;
                        ithaschanged = true;
                        myAtt[attProp]= finalvalue;
                        myAtt.isset= true;
                        //console.log("setting " + modAtt + "=" + finalvalue);
                    }

                }

                else{


                    if((!citem.isreset)||(_mod.exec && jumpmod)){
                        if(!citem.ispermanent){
                            myAtt[attProp] = myAtt.prev;
                            ithaschanged = true;

                        }

                        _mod.exec = false;
                        if(citem.isactive)
                            myAtt.isset= true;

                    }
                    else{
                        if(citem.isactive){
                            myAtt.isset= true;
                        }
                    }




                }

            }

        }

        //CI ADD TO NON AUTO ATTR
        const addmods = mods.filter(y=>y.type=="ADD");
        for(let i=0;i<addmods.length;i++){
            let mod = addmods[i];
            let modAtt = mod.attribute;
            let attProp = "value";
            let modvable = "modified";
            if(modAtt.includes(".max")){
                modAtt = modAtt.replace(".max","");
                attProp = "max";
                modvable = "modmax";
            }
            //console.log(modAtt);
            let jumpmod=false;
            if(mod.condop!="NON" && mod.condop!=null){
                jumpmod = await this.checkModConditional(mod);
            }
            //console.log(jumpmod);
            let citem = await citemIDs.find(y=>y.id==mod.citem);
            let _citem = await game.items.get(mod.citem).data.data;

            if(hasProperty(attributes,modAtt)){
                let seedprop = game.items.get(attributes[modAtt].id);
                //if((seedprop.data.data.auto=="" && seedprop.data.data.automax=="") && (seedprop.data.data.datatype=="simplenumeric" || seedprop.data.data.datatype=="radio")){
                if(((seedprop.data.data.automax=="" && attProp=="max") || (seedprop.data.data.auto=="" && attProp=="value")) && (seedprop.data.data.datatype=="simplenumeric" || seedprop.data.data.datatype=="radio")){

                    let value =mod.value;
                    let finalvalue=value;
                    if(isNaN(value)){
                        if(value.charAt(0)=="|"){
                            value = value.replace("|","");
                            finalvalue = await auxMeth.autoParser(value,attributes,citem.attributes,true,false,citem.number);
                        }
                        else{
                            finalvalue = await auxMeth.autoParser(value,attributes,citem.attributes,false,false,citem.number);
                        }
                    }

                    finalvalue = Number(finalvalue);

                    const myAtt = attributes[modAtt];

                    //                    console.log(mod.citem);
                    //                    console.log(mod.index);

                    const _basecitem = await citemIDs.find(y=>y.id==mod.citem && y.mods.find(x=>x.index==mod.index));
                    const _mod = await _basecitem.mods.find(x=>x.index==mod.index);

                    //console.log(_basecitem.name + " " + _mod.exec);
                    if(_mod.exec && (_mod.value!=finalvalue || _mod.attribute!=modAtt)){
                        console.log("resetting " + _mod.attribute);
                        if(!citem.ispermanent){
                            if(!_mod.attribute.includes(".max")){
                                attributes[_mod.attribute].value = Number(attributes[_mod.attribute].value) - _mod.value;
                            }
                            else{
                                attributes[_mod.attribute].max = Number(attributes[_mod.attribute].max) - _mod.value;
                            }
                        }

                        _mod.exec = false;
                    }

                    //console.log(mod.name + " exec: " + _mod.exec + " isactive " + citem.isactive);
                    if((_citem.usetype=="PAS" || citem.isactive) && !jumpmod){

                        if(!_mod.exec || (myAtt[modvable] && !mod.once)){

                            myAtt.prev= myAtt[attProp];
                            myAtt[attProp] = Number(myAtt[attProp]) + finalvalue;
                            ithaschanged = true;

                            _mod.exec=true;
                            _mod.value=finalvalue;
                            _mod.attribute=modAtt;

                            if(attProp=="value" && myAtt.max!="" && seedprop.data.data.automax!=""){

                                if(myAtt[attProp]>myAtt.max){
                                    myAtt[attProp]=myAtt.max;
                                    ithaschanged = true;
                                }

                            }

                        }


                    }
                    else{
                        //console.log(citem.isreset + " " + citem.isactive + " " + myAtt.default + " " + _mod.exec);
                        if((!citem.isreset || (_mod.exec && jumpmod)) && !citem.isactive && !myAtt.default && !citem.ispermanent){
                            _mod.exec=false;
                            myAtt[attProp] = Number(myAtt[attProp]) - Number(finalvalue);
                            ithaschanged = true;
                        }
                    }

                }

            }
        }

        //AUTO PROPERTIES PRE CALCULATIONS, 2 ROUNDS!!
        for (let j=0;j<2;j++){
            //Checking AUTO ATTRIBUTES -- KEEP DEFAULT VALUE EMPTY THEN!!
            for (let i=0;i<attributearray.length;i++) {
                let attribute = attributearray[i];
                if(attribute!=null || attribute!=undefined){

                    let attdata = attributes[attribute];
                    let rawexp="";
                    let property = await game.items.get(actorData.data.attributes[attribute].id);
                    const actorAtt = attributes[attribute];

                    //console.log("checking " + attribute + " isset " + actorAtt.isset);

                    //Check the Auto value
                    if(property!=null && !actorAtt.isset){
                        let exprmode = false;
                        if(property.data.data.datatype!="simplenumeric" && property.data.data.datatype!="radio"){
                            exprmode = true;
                        }

                        if(property.data.data.auto !==""){
                            //console.log("autochecking " + attribute);
                            rawexp = property.data.data.auto;
                            let newvalue = await auxMeth.autoParser(rawexp,attributes,null,exprmode)

                            if(actorAtt.value!=newvalue)
                                ithaschanged = true;
                            actorAtt.default= true;

                            actorAtt.value = newvalue;
                            //console.log("defaulting " + attribute + " to " + newvalue + " isset: " + actorAtt.isset);
                        }

                        if(property.data.data.automax !==""){
                            rawexp = property.data.data.automax;
                            let maxval = await auxMeth.autoParser(rawexp,attributes,null,false);

                            //if(actorAtt.max!=maxval){
                            if(actorAtt.max=="" || !actorAtt.maxblocked){
                                actorAtt.max = parseInt(maxval);
                                actorAtt.maxblocked = false;
                                ithaschanged = true;

                                //console.log(attribute + " max: " + actorAtt.maxblocked);
                                if(parseInt(actorAtt.value)>actorAtt.max){
                                    actorAtt.value=actorAtt.max;
                                }
                            }
                        }
                    }
                }
            }

        }


        //CI ADD TO AUTO ATTR
        for(let i=0;i<addmods.length;i++){
            let mod = addmods[i];
            let modAtt = mod.attribute;
            let attProp = "value";
            let modvable="modified";
            if(modAtt.includes(".max")){
                modAtt = modAtt.replace(".max","");
                attProp = "max";
                modvable = "modmax";
            }
            let jumpmod=false;
            if(mod.condop!="NON" && mod.condop!=null){
                jumpmod = await this.checkModConditional(mod);
            }

            let citem = citemIDs.find(y=>y.id==mod.citem);
            let _citem = game.items.get(mod.citem).data.data;

            //console.log("entering " + mod.name + " " + jumpmod);
            if(hasProperty(attributes,modAtt)){
                let seedprop = game.items.get(attributes[modAtt].id);
                if(((seedprop.data.data.automax!="" && attProp=="max") || (seedprop.data.data.auto!="" && attProp=="value")) && (seedprop.data.data.datatype=="simplenumeric" || seedprop.data.data.datatype=="radio")){
                    let value =mod.value;
                    let finalvalue=value;

                    if(isNaN(value)){
                        if(value.charAt(0)=="|"){
                            value = value.replace("|","");
                            finalvalue = await auxMeth.autoParser(value,attributes,citem.attributes,true,false,parseInt(citem.number));
                        }
                        else{
                            finalvalue = await auxMeth.autoParser(value,attributes,citem.attributes,false,false,parseInt(citem.number));
                        }
                    }
                    //console.log("finalvalue:" + finalvalue);

                    const myAtt = attributes[modAtt];
                    const _basecitem = await citemIDs.find(y=>y.id==mod.citem && y.mods.find(x=>x.index==mod.index));
                    //console.log(_basecitem);

                    if(_basecitem!=null){
                        const _mod = await _basecitem.mods.find(x=>x.index==mod.index);

                        //console.log(_basecitem.name + " _mod.exec:" + _mod.exec + " toadd:" + finalvalue);

                        if(_mod.exec && (_mod.value!=finalvalue || _mod.attribute!=modAtt)){
                            console.log("resetting " + _mod.attribute);
                            if(!citem.ispermanent){
                                if(!_mod.attribute.includes(".max")){
                                    attributes[_mod.attribute].value = Number(attributes[_mod.attribute].value) - _mod.value;
                                }
                                else{
                                    attributes[modAtt].max = Number(attributes[modAtt].max) - _mod.value;
                                }
                            }


                            _mod.exec = false;
                        }
                        //console.log(myAtt);
                        if(myAtt.isset)
                            _mod.exec=false;

                        //console.log("current value:" + attributes[_mod.attribute].value);

                        //console.log("Previo exec:" + _mod.exec + " name:" + citem.name + " isactive:" + citem.isactive + " value:" + finalvalue + " isset:" + myAtt.isset);
                        if((_citem.usetype=="PAS" || citem.isactive) && !jumpmod){

                            //console.log(attProp + " :att/Prop - auto: " + seedprop.data.data.auto);
                            //if(!_mod.exec || (myAtt[modvable] && !mod.once)){
                            //if((seedprop.data.data.automax!="" && attProp=="max") || (seedprop.data.data.auto!="" && attProp=="value")){
                            //console.log("activating mod");
                            ithaschanged = true;
                            _mod.exec=true;
                            _mod.value=finalvalue;
                            _mod.attribute=mod.attribute;

                            myAtt[attProp] = await Number(myAtt[attProp]) + Number(finalvalue);

                            if(attProp=="value" && myAtt.max!="" && seedprop.data.data.automax!=""){
                                //console.log("changemax");
                                if(myAtt[attProp]>myAtt.max){
                                    myAtt[attProp]=myAtt.max;
                                    ithaschanged = true;
                                }

                            }

                            //}

                        }

                        else{

                            if((!citem.isreset || jumpmod) && !_citem.isactive){

                                if(!myAtt.default && _mod.exec && !citem.ispermanent){
                                    //console.log("removing mod");
                                    myAtt[attProp] = Number(myAtt[attProp]) - Number(finalvalue);
                                    ithaschanged = true;
                                }

                                _mod.exec=false;

                            }
                        }
                    }
                    else{
                        //Error on citem,just remove it
                        citemIDs.splice(citemIDs.indexOf(citem),1);
                    }

                    //console.log("exec:" + _mod.exec + " name:" + citem.name + " default:" + myAtt.default + " isreset:" + citem.isreset + " value:" + finalvalue + " isset:" + myAtt.isset);

                }

            }
        }



        //ADD ROLLS
        const rollmods = mods.filter(y=>y.type=="ROLL");
        //
        for(let roll in rolls){
            //ithaschanged = true;

            rolls[roll].modified = false;
            rolls[roll].value="";


        }

        for(let i=0;i<rollmods.length;i++){
            let mod = rollmods[i];
            //console.log(mod);
            let rollID = mod.attribute;
            let rollvaluemod = mod.value;
            //console.log(mod);
            let citem = citemIDs.find(y=>y.id==mod.citem);
            let _citem = game.items.get(mod.citem).data.data;

            let jumpmod=false;
            if(mod.condop!="NON" && mod.condop!=null){
                jumpmod = await this.checkModConditional(mod);
            }

            if(!jumpmod){

                if(!hasProperty(rolls,rollID)){
                    setProperty(rolls,rollID,{});
                    setProperty(rolls[rollID],"value","");
                    //ithaschanged = true;
                }



                let toadd = await auxMeth.autoParser(rollvaluemod,attributes,citem.attributes,false,false,citem.number);
                //console.log(toadd);
                let r_exp = "+(" + toadd + ")";
                const _basecitem = await citemIDs.find(y=>y.id==citem.id && y.mods.find(x=>x.index==mod.index));
                //console.log(mod.name);
                const _mod = await _basecitem.mods.find(x=>x.index==mod.index);
                rolls[rollID].modified = true;

                if((_citem.usetype=="PAS" || citem.isactive)){

                    //if(!_mod.exec){
                    _mod.exec=true;
                    ithaschanged = true;
                    //rolls[rollID].value += parseInt(toadd);
                    //console.log(rollID + " previo " + rolls[rollID].value)
                    rolls[rollID].value += r_exp;

                    //console.log("adding " + rollID + toadd +  " total: " + rolls[rollID].value);
                    //}

                }

                //                else{
                //                    if(_mod.exec){
                //                        ithaschanged = true;
                //                        //rolls[rollID].value -= parseInt(toadd);
                //                        rolls[rollID].value.replace(r_exp,"");
                //                        console.log("removing " + rollID + toadd +  " total: " + rolls[rollID].value);
                //                    }
                //                    _mod.exec=false;
                //
                //                }


            }
        }
        let counter=0;
        //console.log(rolls);
        for(let roll in rolls){

            if(!rolls[roll].modified || rolls[roll].value==0)
                delete rolls[roll];

            counter++;
        }

        //console.log(rolls);
        //PARSE VALUES TO INT
        for (let i=0;i<attributearray.length;i++){
            let attribute = attributearray[i];
            let attdata = attributes[attribute];
            let property = await game.items.get(actorData.data.attributes[attribute].id);
            const actorAtt = actorData.data.attributes[attribute];
            if(property!=null){
                if(property.data.data.defvalue!="" && property.data.data.auto=="" && actorAtt.value==""){
                    ithaschanged = true;
                    actorAtt.value = await auxMeth.autoParser(property.data.data.defvalue,attributes,null,false);
                    //console.log("defaulting " + attribute + actorAtt.value);
                }
                if(property.data.data.datatype=="simplenumeric" || property.data.data.datatype=="radio"){

                    actorAtt.value = parseInt(actorAtt.value);
                    actorAtt.max = parseInt(actorAtt.max);
                }

            }

            else{
                delete actorData.data.attributes[attribute];
                ithaschanged = true;
            }
            if(attributearray[i]!="biography"){
                attdata.modified = false;
                attdata.modmax = false;

            }

        }

        //CONSUMABLES ACTIVE TURN BACK INTO INACTIVE, AND DELETE SELFDESTRUCTIBLE
        for(let n=citemIDs.length-1;n>=0;n--){
            let citemObj = game.items.get(citemIDs[n].id).data.data;

            if(citemIDs[n].isactive){
                if(citemObj.usetype == "CON"){
                    citemIDs[n].isactive =false;
                    for(let j=0;j<citemIDs[n].mods.length;j++){

                        citemIDs[n].mods[j].exec=false;
                    }

                    if(!citemIDs[n].rechargable && citemIDs[n].number<=0){
                        //await citemIDs.splice(n,1);
                        await this.deletecItem(citemIDs[n].id,true);
                    }
                }

                else{

                    citemIDs[n].ispermanent =false;
                }

            }
            else{
                citemIDs[n].isreset =true;
            }

            if(citemIDs[n]!=null)
                //Self destructible items
                if(citemIDs[n].selfdestruct!=null)
                    if(citemIDs[n].selfdestruct)
                        await this.deletecItem(citemIDs[n].id,true);


        }

        //Set attribtues to new ones
        //console.log(this);
        this.data.data.attributes = attributes;
        this.data.data.rolls = rolls;

        if(ithaschanged || this.data.flags.haschanged){
            //console.log("changes in data");
            //console.log(attributes);
            await this.update({data:this.data.data},{diff: false});

        }


        //return actorData;

    }

    async actorUpdater(data=null){
        //console.log("updating");
        if(!this.owner)
            return;

        this.data.flags.ischeckingauto = true;       

        if(data==null)
            data=this.data;

        await this.checkPropAuto(data);
        if(this.token!=null){
            await this.update({data:this.data},{diff: false});

        }

        this.data.flags.ischeckingauto = false;
        this.data.flags.haschanged=false;
        console.log("update finished");

    }


    async rollSheetDice(rollexp,rollname,rollid,actorattributes,citemattributes,number=1,target=null){

        //console.log(rollexp);
        //console.log(citemattributes.name);

        let initiative=false;
        let rolltotal=0;
        let conditionalText="";
        //let diff = SBOX.diff[game.data.world.name];
        let diff = await game.settings.get("sandbox", "diff");
        //console.log(diff);

        //Roll modifiers generated by MODs of ROLL type
        let actorrolls = this.data.data.rolls;

        //Rolls defined by expression
        let subrolls =[];

        //Check roll mode
        let rollmode = this.data.data.rollmode;
        if (citemattributes!=null)
            rollname = rollname.replace("#{name}",citemattributes.name);

        //Parse roll difficulty in name, and general atts
        rollname = rollname.replace(/\#{diff}/g,diff);
        rollname = await auxMeth.autoParser(rollname,actorattributes,null,true,false,number);

        //Parse roll difficulty
        rollexp = rollexp.replace(/\#{diff}/g,diff);
        if (citemattributes!=null)
            rollexp = rollexp.replace("#{name}",citemattributes.name);

        //Parse target attribute
        let targetexp = rollexp.match(/(?<=\#{target\|)\S*?(?=\})/g);
        if(targetexp!=null){
            for (let j=0;j<targetexp.length;j++){
                let idexpr = targetexp[j];
                let idtoreplace = "#{target|" + targetexp[j]+ "}";
                let newid;
                if(target!=null){
                    let targetattributes = target.actor.data.data.attributes;
                    newid = await auxMeth.autoParser("__"+idexpr+"__",targetattributes,null,true);
                }

                if(newid==null)
                    newid=0;

                rollexp = rollexp.replace(idtoreplace,newid);
            }  
        }

        //console.log(rollexp);
        //Preparsing TO CHECK IF VALID!!!
        if(rollexp.includes("!"))
            rollexp = await auxMeth.autoParser(rollexp,actorattributes,citemattributes,false,false,number);

        //Parse sub rolls !() into indexed string ··!1,··!2,etc
        let subrollsexp = rollexp.match(/(?<=\!\()\S*?(?=\))/g);
        if(subrollsexp!=null){
            //Parse Roll

            //console.log(rollexp);
            for (let i=0;i<subrollsexp.length;i++){
                let tochange = "!(" + subrollsexp[i]+ ")";
                let blocks = subrollsexp[i].split(";");

                //Definition of sub Roll
                let sRoll = {};

                sRoll.name = blocks[0];
                sRoll.expr = await auxMeth.autoParser(blocks[1],actorattributes,citemattributes,true,false,number);
                sRoll.rolls = new Roll(sRoll.expr).roll();
                sRoll.total = sRoll.rolls.total;

                if(game.dice3d!=null){
                    await game.dice3d.showForRoll(sRoll.rolls,game.user,true);
                }

                setProperty(sRoll.rolls,"extraroll",true);

                subrolls.push(sRoll);

                let index = "··!"+i+"!";

                //rollexp = rollexp.replace(tochange,sRoll.total);
                rollexp = rollexp.replace(tochange,index);
            }
        }

        //console.log(rollexp);

        //Check roll ids
        if (rollid==null)
            rollid=[];

        for(let n=0;n<rollid.length;n++){
            if(rollid[n]=="init")
                initiative = true;
        }

        //Remove rollIDs and save them
        let parseid = rollexp.match(/(?<=\~)\S*?(?=\~)/g);
        if(parseid!=null){
            for (let j=0;j<parseid.length;j++){
                let idexpr = parseid[j];
                let idtoreplace = "~" + parseid[j]+ "~";
                let newid = await auxMeth.autoParser(idexpr,actorattributes,citemattributes,true,number);

                if(newid!="")
                    rollid.push(newid);

                if(parseid[j]=="init")
                    initiative=true;

                if(parseid[j]=="ADV")
                    rollmode = "ADV";

                if(parseid[j]=="DIS")
                    rollmode = "DIS";

                rollexp = rollexp.replace(idtoreplace,"");
            }  
        }

        //console.log(rollexp);
        //console.log(rollid);

        //Set ADV or DIS
        if(rollmode=="ADV"){
            rollexp = rollexp.replace("1d20","2d20kh");
        }

        if(rollmode=="DIS"){
            rollexp = rollexp.replace("1d20","2d20kl");
        }

        //console.log(rollexp);

        //Parse Roll
        rollexp = await auxMeth.autoParser(rollexp,actorattributes,citemattributes,true,false,number);

        //Remove conditionalexp and save it
        let condid = rollexp.match(/(?<=\&\&)(.*?)(?=\&\&)/g);
        if(condid!=null){
            for (let j=0;j<condid.length;j++){
                let condidexpr = condid[j];
                let conddtoreplace = "&&" + condid[j]+ "&&";

                conditionalText = condidexpr;

                rollexp = rollexp.replace(conddtoreplace,"");
            }  
        }

        //console.log(rollexp);
        //console.log(subrolls);
        let roll;
        let multiroll=[];

        let rollformula = rollexp;

        //PARSE Asuccess rolls
        var succresult = rollexp.match(/(?<=\¬\¬)\S*?(?=\¬\¬)/g);
        if(succresult!=null){
            let allrolls;

            //Substitute string for current value
            for (let i=0;i<succresult.length;i++){
                //                let debugname = attpresult[i];
                //                console.log(debugname);
                let tochange = "¬¬" + succresult[i]+ "¬¬";

                let blocks = succresult[i].split(",");

                let succRoll = blocks[0];

                let rollMod;

                let finalvalue=0;
                if(succRoll.includes("d2")||succRoll.includes("d3")||succRoll.includes("d4")||succRoll.includes("d6")||succRoll.includes("d8")||succRoll.includes("d10")||succRoll.includes("d12")||succRoll.includes("d20")||succRoll.includes("d100")||succRoll.includes("··!")){
                    let numDices=1;
                    let diceType;
                    let foundDice=false;
                    let succRollfinal = succRoll;

                    if(succRoll.includes("··!")){
                        succRoll = succRoll.replace("··!",""); 
                        succRoll = succRoll.replace("!","");

                        allrolls = subrolls[parseInt(succRoll)].rolls;
                        rollformula = await rollformula.replace(tochange,subrolls[parseInt(succRoll)].expr);
                    }
                    else{
                        let splitter = succRoll.split("d");

                        numDices = new Roll(splitter[0]).roll().total;
                        diceType = splitter[1];

                        if(isNaN(diceType)){
                            if(diceType.charAt(0)=="1"){
                                diceType = diceType.charAt(0) + diceType.charAt(1);
                            }
                            else{
                                //IF arithmetic expression with dice checker:
                                rollMod = diceType.substring(1,diceType.length+1);
                                diceType = diceType.charAt(0);
                            }

                            //console.log(rollMod);
                        }

                        succRoll=numDices+"d"+diceType;

                        if(numDices<1)
                            succRoll="0";
                        let partroll = new Roll(succRoll);
                        allrolls = await partroll.roll();
                        if(game.dice3d!=null){
                            await game.dice3d.showForRoll(partroll,game.user,true);
                        }


                    }

                    rollformula = rollformula.replace(tochange,succRoll);

                    multiroll.push(allrolls);

                    if(numDices>0){


                        for(let y=0;y<allrolls.dice[0].rolls.length;y++){

                            let midvalue = 0;

                            let succvalue = allrolls.dice[0].rolls[y].roll;

                            if(rollMod!=null){
                                succvalue = new Roll(succvalue+rollMod).roll().total;
                            }

                            //console.log(succvalue);

                            for(let j=1;j<blocks.length;j++){
                                let blockarray = blocks[j];
                                let splitblock = blockarray.split(":");
                                let condition = splitblock[0];
                                let returnvalue = splitblock[1];

                                if(isNaN(condition)){
                                    let newroll = new Roll(condition).roll();
                                    condition = newroll.total; 
                                }

                                if(succvalue>=condition){
                                    midvalue = parseInt(returnvalue);
                                }
                            }

                            finalvalue += midvalue;



                        }
                    }


                }

                //rolltotal += finalvalue;
                rollexp = rollexp.replace(tochange,finalvalue);

            }


        }

        //console.log(rollexp);

        //PARSE SUBROLLS
        var attpresult = rollexp.match(/(?<=\·\·\!)\S*?(?=\!)/g);
        if(attpresult!=null){

            //Substitute string for current value
            for (let i=0;i<attpresult.length;i++){
                //                let debugname = attpresult[i];
                //                console.log(debugname);
                let attname = "··!" + attpresult[i]+ "!";
                let attindex = attpresult[i];
                let attvalue = subrolls[parseInt(attindex)].total;

                rollexp = rollexp.replace(attname,attvalue);
                rollformula = rollformula.replace(attname,subrolls[parseInt(attindex)].expr);
            }         

        }

        //Add ROLL MODS
        let extramod = 0;
        let extramodstring="";
        for (let k=0;k<rollid.length;k++){
            if(rollid[k]!="" && hasProperty(actorrolls,rollid[k])){
                rollformula += actorrolls[rollid[k]].value;
                rollexp += actorrolls[rollid[k]].value;
            }
        }


        //console.log(rollexp);
        let partroll = new Roll(rollexp);
        roll = partroll.roll();

        if(game.dice3d!=null){
            await game.dice3d.showForRoll(partroll,game.user,true);
        }

        rolltotal = roll.total;
        if(roll.formula.charAt(0)!="-" || roll.formula.charAt(0)!="0")
            multiroll.push(roll);



        //        console.log(multiroll);
        //        console.log(rollexp);

        //Generate Roll data
        //        let extramod = 0;
        //        let extramodstring="";
        //        for (let k=0;k<rollid.length;k++){
        //            if(rollid[k]!="" && hasProperty(actorrolls,rollid[k])){
        //                extramod += parseInt(actorrolls[rollid[k]].value);
        //                if(extramod!=0)
        //                    extramodstring = " + " + actorrolls[rollid[k]].value;
        //            }
        //        }

        let formula = rollformula.replace(/\s[0]\s\+/g,"");

        //CHECK CRITS AND FUMBLES TO COLOR THE ROLL
        let hascrit = false;
        let hasfumble = false;
        let rolldice;
        //console.log(multiroll);
        for(let j=0;j<multiroll.length;j++){
            let multirolldice = multiroll[j].dice;
            //console.log(multirolldice);
            if(!hasProperty(multiroll[j],"extraroll") && multirolldice.length>0){
                if(rolldice==null){
                    rolldice=multirolldice;
                }
                else{
                    rolldice.push(multirolldice[0]);
                }

            }

            for(let i=0;i<multirolldice.length;i++){
                let maxres = multirolldice[i].faces;

                let _hascrit = multirolldice[i].results.includes(maxres);
                let _hasfumble = multirolldice[i].results.includes(1);

                if(_hascrit)
                    hascrit = true;
                if(_hasfumble)
                    hasfumble = true;

            }
        }

        if(this.data.data.mod=="" || this.data.data.mod==null)
            this.data.data.mod = 0;

        rolltotal = parseInt(rolltotal) + parseInt(this.data.data.mod) + extramod;

        let convalue = null;
        if(conditionalText!=""){
            convalue = await auxMeth.autoParser(conditionalText,actorattributes,citemattributes,true,false,number);
            convalue = convalue.replace(/\;/g,',');
            convalue = "%["+rolltotal + "," + convalue + "]";
            convalue = await auxMeth.autoParser(convalue,actorattributes,citemattributes,true,false,number);
        }

        //console.log(rolldice);
        //console.log(subrolls);

        let rollData = {
            token:{
                img:this.img,
                name:this.name
            },
            actor:this.name,
            flavor: rollname,
            formula: formula + extramodstring,
            mod: this.data.data.mod,
            result: rolltotal,
            dice: rolldice,
            subdice: subrolls,
            user: game.user.name,
            conditional: convalue,
            iscrit: hascrit,
            isfumble: hasfumble
        };

        renderTemplate("systems/sandbox/templates/dice.html", rollData).then(html => {
            let newmessage = ChatMessage.create({
                content: html
            });

            //if(game.user.isGM){
            auxMeth.rollToMenu(html);
            //}
        });

        if(initiative){
            await this.setInit(rollData.result);
        }

        return rollData.result;
    }

    sendMsgChat(flavor,msg,submsg){
        let rollData = {
            token:{
                img:this.img,
                name:this.name
            },
            actor:this.name,
            flavor: flavor,
            msg: msg,
            user: game.user.name,
            submsg: submsg
        };


        renderTemplate("systems/sandbox/templates/msg.html", rollData).then(html => {
            ChatMessage.create({
                content: html
            });

            //if(game.user.isGM){
            auxMeth.rollToMenu(html);
            //}
        });
    }

    async setInit(roll){
        console.log("setting init");
        const tokens = canvas.tokens.ownedTokens;

        for(let i=0;i<tokens.length;i++){
            let token = tokens[i];
            const actor = token.actor;

            if(this.data._id == actor._id){
                //The following is for initiative
                const combatants = game.combat.combatants;
                for(let j=0;j<combatants.length;j++){
                    let _combatant = game.combat.combatants[j];

                    if(_combatant.tokenId == token.data._id){

                        game.combat.updateCombatant({_id: _combatant._id, initiative: roll});
                    }

                }
            }



        }

        //THIS IS THE MACRO FOR NPCS ROLLS/INITIATIVE!!!
        //        ( async () => {
        //        let rollexp = "ROLEXPRESION";
        //        let rollname = "INICIATIVA";
        //            const selected = canvas.tokens.controlledTokens;
        //
        //            for(let i=0;i<selected.length;i++){
        //                let token = selected[i];
        //                const actor = token.actor;
        //                let result = await actor.rollSheetDice(rollexp,rollname,null,actor.data.data.attributes,null);
        //                //The following is for initiative
        //                const combatants = game.combat.combatants;
        //                for(let j=0;j<combatants.length;j++){
        //                    let _combatant = game.combat.combatants[j];
        //
        //                    if(_combatant.tokenId == token.data._id){
        //
        //                        game.combat.updateCombatant({_id: _combatant._id, initiative: result});
        //                    }
        //
        //                }
        //
        //            }
        //        }
        //        )();

        //THIS IS THE MACRO FOR CITEM NPCS ROLLS!!!
        //        ( async () => {
        //            let propKey = "tiradaataquepnj";
        //            let citemname = "Ataque 1";
        //            
        //            let property = game.items.find(y=>y.type=="property" && y.data.data.attKey==propKey);
        //            let citemattributes;
        //            const selected = canvas.tokens.controlledTokens;
        //
        //            for(let i=0;i<selected.length;i++){
        //                let token = selected[i];
        //                const actor = token.actor;
        //
        //                let citem = actor.data.data.citems.find(y=>y.name == citemname);
        //                if(citem==null)
        //                    return;
        //
        //                citemattributes = citem.attributes;
        //                
        //                let rollexp = property.data.data.rollexp;
        //                let rollname = property.data.data.rollname;
        //                rollname = rollname.replace("#{name}",citem.name);
        //                let result = await actor.rollSheetDice(rollexp,rollname,null,actor.data.data.attributes,citemattributes);
        //
        //            }
        //        }
        //        )();

        //THIS IS THE MACRO FOR NPC ATTRIBUTE ROLLS!
        //        ( async () => {
        //            let propKey = "punteria";
        //            
        //            let property;
        //            let citemattributes;
        //            const selected = canvas.tokens.controlled;
        //
        //            for(let i=0;i<selected.length;i++){
        //                let token = selected[i];
        //                const actor = token.actor;
        //
        //                property = game.items.find(y=>y.type=="property" && y.data.data.attKey==propKey);
        //                if(property==null)
        //                    return;
        //
        //                let rollexp = property.data.data.rollexp;
        //                let rollname = property.data.data.rollname;
        //                rollname = rollname.replace("#{name}",citem.name);
        //                let result = await actor.rollSheetDice(rollexp,rollname,null,actor.data.data.attributes,citemattributes);
        //
        //            }
        //        }
        //        )();



    }


}