import { SBOX } from "./config.js";

export class auxMeth {

    /** Gets Sheets */
    static async getSheets(){
        //console.log("getting sheets");

        SBOX.templates = [];

        SBOX.templates.push("Default");

        let templates = game.actors.filter(y=>y.data.data.istemplate);

        for(let i=0;i<templates.length;i++){
            if(!SBOX.templates.includes(templates[i].data.data.gtemplate))
                SBOX.templates.push(templates[i].data.data.gtemplate);
        }

        //console.log(SBOX.templates);

    }

    /* -------------------------------------------- */

    static async retrieveBTemplate(){

        var form = await fetch("systems/sandbox/templates/character.html").then(resp => resp.text());

        return form;

    }

    static async buildSheetHML(){
        console.log("building base html");
        var parser = new DOMParser();
        var htmlcode = await auxMeth.retrieveBTemplate();
        SBOX.sheethtml = parser.parseFromString(htmlcode, 'text/html');
    }

    static async registerIfHelper(){
        Handlebars.registerHelper('ifCond', function(v1, v2, options) {
            if(v1 === v2) {
                return options.fn(this);
            }
            return options.inverse(this);
        });
    }

    static async registerIfGreaterHelper(){
        Handlebars.registerHelper('ifGreater', function(v1, v2, options) {
            if(parseInt(v1) > parseInt(v2)) {
                return options.fn(this);
            }
            return options.inverse(this);
        });
    }

    static async registerIfLessHelper(){
        Handlebars.registerHelper('ifLess', function(v1, v2, options) {
            if(v1 < v2) {
                return options.fn(this);
            }
            return options.inverse(this);
        });
    }

    static async registerIfNotHelper(){
        Handlebars.registerHelper('ifNot', function(v1, v2, options) {
            if(v1 !== v2) {
                return options.fn(this);
            }
            return options.inverse(this);
        });
    }

    static async registerIsGM(){
        Handlebars.registerHelper('isGM', function(options) {
            if(game.user.isGM) {
                return options.fn(this);
            }
            return options.inverse(this);
        });
    }

    static async registerShowMod(){
        Handlebars.registerHelper('advShow', function(options) {
            if(game.settings.get("sandbox", "showADV")) {
                return options.fn(this);
            }
            return options.inverse(this);
        });
    }

    static async registerShowSimpleRoll(){
        Handlebars.registerHelper('showRoller', function(options) {
            if(game.settings.get("sandbox", "showSimpleRoller")) {
                return options.fn(this);
            }
            return options.inverse(this);
        });
    }

    static async autoParser(expr,attributes,itemattributes,exprmode,noreg=false,number=1){
        var toreturn = expr;
        //console.log(expr);
        //console.log(itemattributes);
        //console.log(number);

        //Expression register. Recommended to avoid REgex shennanigans
        let regArray =[];
        let expreg;
        if(!noreg)
            expreg = expr.match(/(?<=\$\<).*?(?=\>)/g);
        if(expreg!=null){

            //Substitute string for current value
            for (let i=0;i<expreg.length;i++){
                let attname = "$<" + expreg[i]+ ">";
                let attvalue="";

                let regblocks = expreg[i].split(";");

                let regobject = {};
                regobject.index = regblocks[0];
                regobject.expr = regblocks[1];
                regobject.result = await auxMeth.autoParser(regblocks[1],attributes,itemattributes,false,true);
                regArray.push(regobject);

                expr = expr.replace(attname,attvalue);

            }

            let exprparse = expr.match(/(?<=\$)[0-9]/g);

            for (let i=0;i<exprparse.length;i++){
                let regindex = exprparse[i];

                let attname = "$" + regindex;
                let regObj = regArray.find(y=>y.index==regindex);

                let attvalue="";
                if(regObj!=null)
                    attvalue = regObj.result;

                //console.log(attvalue);
                expr = expr.replace(attname,attvalue);
            }
        }

        //Parses last roll
        if(itemattributes!=null && expr.includes("#{roll}")){
            expr=expr.replace("#{roll}",itemattributes._lastroll);
        }

        //Parses number of citems
        if(itemattributes!=null && expr.includes("#{num}")){
            expr=expr.replace("#{num}",number);
        }

        //console.log(expr);

        //PARSE ITEM ATTRIBUTES
        var itemresult = expr.match(/(?<=\#\{).*?(?=\})/g);
        if(itemresult!=null && itemattributes!=null){

            //Substitute string for current value
            for (let i=0;i<itemresult.length;i++){
                let attname = "#{" + itemresult[i]+ "}";
                let attvalue;
                if(itemattributes[itemresult[i]]!=null)
                    attvalue = itemattributes[itemresult[i]].value;
                if(attvalue=="" || attvalue ==null)
                    attvalue=0;

                if(!itemresult[i].includes("#{target|"))
                    expr = expr.replace(attname,attvalue);

            }      

        }
        //console.log(expr);
        //PARSE ACTOR ATTRIBUTES

        var result = expr.match(/(?<=\@\{).*?(?=\})/g);
        if(result!=null){

            //Substitute string for current value
            for (let i=0;i<result.length;i++){
                let rawattname = result[i];
                let attProp = "value";
                if(rawattname.includes(".max")){
                    rawattname = rawattname.replace(".max","");
                    attProp = "max";
                }

                let attname = "@{" + result[i]+ "}";
                let attvalue;

                if(attributes!=null){
                    let myatt = attributes[rawattname];

                    if(myatt!=null){
                        attvalue = myatt[attProp];
                    }

                    if((attvalue=="" || attvalue ==null)&&((attvalue!=false)&&(attvalue!=true)))
                        attvalue=0;

                }
                else{
                    attvalue=0;
                }


                expr = expr.replace(attname,attvalue);
            }         

        }

        //PARSE ITEM ATTRIBUTE
        var attcresult = expr.match(/(?<=\-\-)\S*?(?=\-\-)/g);
        if(attcresult!=null){

            //Substitute string for current value
            for (let i=0;i<attcresult.length;i++){
                let attname = "--" + attcresult[i]+ "--";
                let attvalue;
                if(itemattributes[attcresult[i]]!=null)
                    attvalue = itemattributes[attcresult[i]].value;
                if(attvalue=="" || attvalue ==null)
                    attvalue=0;
                console.log(attname + " " + attvalue);
                expr = expr.replace(attname,attvalue);
            }         

        }

        //console.log(expr);

        //PARSE ACTOR ATTRIBUTE
        var attpresult = expr.match(/(?<=\_\_)\S*?(?=\_\_)/g);
        if(attpresult!=null){

            //Substitute string for current value
            for (let i=0;i<attpresult.length;i++){
                //                let debugname = attpresult[i];
                //                console.log(debugname);
                let attname = "__" + attpresult[i]+ "__";
                let attvalue=0;
                if(attributes[attpresult[i]]!=null)
                    attvalue = attributes[attpresult[i]].value;

                expr = expr.replace(attname,attvalue);
            }         

        }

        //console.log(expr);
        //PARSE SCALED AUTO VALUES
        var scaleresult = expr.match(/(?<=\%\[).*?(?=\])/g);
        if(scaleresult!=null){

            //Substitute string for current value
            for (let i=0;i<scaleresult.length;i++){
                let limits = scaleresult[i].split(",");
                let roll = new Roll(limits[0]).roll();
                let value = roll.total;
                let valuemod=0;
                for(let j=1;j<limits.length;j++){
                    let splitter = limits[j].split(":");
                    let scale = splitter[0];
                    if(isNaN(scale) || scale.includes('+')|| scale.includes('-')|| scale.includes('/')|| scale.includes('*')){
                        let newroll = new Roll(scale).roll();
                        scale = newroll.total; 
                    }
                    let mod = splitter[1];
                    if(value>=scale){
                        valuemod=mod;
                    }
                }

                let attname = "%[" + scaleresult[i]+ "]";
                expr = expr.replace(attname,valuemod);
            }         

        }
        //console.log(expr);
        //PARSE CONDITIONAL / ONLY FOR TEXT
        var ifresult = expr.match(/(?<=\if\[).*?(?=\])/g);
        if(ifresult!=null){

            //Substitute string for current value
            for (let i=0;i<ifresult.length;i++){
                let limits = ifresult[i].split(",");
                let truevalue = limits[1];
                let falsevalue = limits[2];
                let finalvalue;
                let conditionarray = limits[0].split(":");
                let condition = conditionarray[0];
                let conditioncheck = conditionarray[1];
                //console.log(condition + " / " + conditioncheck);
                //console.log(truevalue + " " + falsevalue);
                if(condition==conditioncheck){
                    finalvalue = truevalue;
                }

                else{
                    finalvalue = falsevalue;
                }

                let attname = "if[" + ifresult[i]+ "]";
                expr = expr.replace(attname,finalvalue);
                //console.log(expr);
            }         

        }

        //PARSE MAX ROLL
        var maxresult = expr.match(/(?<=\max\().*?(?=\))/g);
        if(maxresult!=null){
            for (let i=0;i<maxresult.length;i++){
                let attname = "max(" + maxresult[i]+ ")";
                let newroll = new Roll(maxresult[i]).roll();

                let attvalue = 0;
                for(let j=0;j<newroll._dice.length;j++){
                    let diceexp = newroll._dice[j];
                    attvalue += parseInt(diceexp.rolls.length)*parseInt(diceexp.faces);
                }



                expr = expr.replace(attname,attvalue);
            }
        }

        //console.log(expr);

        toreturn = expr;
        //console.log(expr);

        //PARSE TO TEXT
        if(expr.includes("|")){
            expr = expr.replace("|","");
            exprmode=true;
        }

        if(isNaN(expr)){

            if(!exprmode){
                try{
                    let final = new Roll(expr);
                    //console.log(expr);
                    final.roll();
                    if(isNaN(final.total)||final.total==null)
                    {
                        toreturn = expr;
                    }
                    else{
                        toreturn = final.total;
                    }
                }
                catch(err){
                    toreturn = expr;
                }

            }

            else{

                //PARSE BOOL
                if(expr == "false"){
                    expr=false;
                }

                if(expr=="true"){
                    expr=true;
                }

                toreturn = expr;
            }   
        }

        return toreturn;
    }

    static dynamicSort(property){
        var sortOrder = 1;
        if(property[0] === "-") {
            sortOrder = -1;
            property = property.substr(1);
        }
        return function (a,b) {
            /* next line works with strings and numbers, 
         * and you may want to customize it to your needs
         */
            var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
            return result * sortOrder;
        }
    }

    static rollToMenu(html=null){

        if(!game.settings.get("sandbox", "showLastRoll"))
            return;

        //console.log("rolling to menu");
        let hotbar = document.getElementById("hotbar");
        hotbar.className = "flexblock-left-nopad";

        let actionbar = document.getElementById("action-bar");
        if(actionbar!=null)
            actionbar.className = "action-bar-container";

        let prevmenu = hotbar.querySelector(".roll-menu");

        if(prevmenu!=null)
            prevmenu.remove();

        let tester = document.createElement("DIV");

        if(html==null){
            let lastmessage;
            let found = false;

            for(let i=game.messages.size-1;i>=0;i--){
                let amessage = game.messages.entities[i];
                if(!found){
                    if(amessage.data.content.includes("roll-template")){
                        found=true;
                        lastmessage =amessage;
                    }

                }

            }


            if(lastmessage==null)
                return;
            let msgContent = lastmessage.data.content;

            tester.innerHTML = msgContent;
        }

        else{
            tester.innerHTML = html;
        }

        let rollextra = tester.querySelector(".roll-extra");
        rollextra.style.display="none";


        let rollMenu = document.createElement("DIV");
        rollMenu.className = "roll-menu";
        rollMenu.innerHTML = tester.innerHTML;
        //console.log("appending");
        hotbar.appendChild(rollMenu);
    }

}

