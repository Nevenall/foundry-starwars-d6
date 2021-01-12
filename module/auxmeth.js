import { SBOX } from "./config.js";

export class auxMeth {

    /** Gets Sheets */
    static async getSheets(){
        //console.log("getting sheets");

        let templates = [];


        templates.push("Default");

        let templatenames = game.actors.filter(y=>y.data.data.istemplate);

        for(let i=0;i<templatenames.length;i++){

            templates.push(templatenames[i].name);
        }

        //console.log(templates);
        return templates;

    }

    static async getTempHTML(gtemplate){

        let html="";

        //console.log(this.actor.data.data.gtemplate);
        let mytemplate = gtemplate;
        if(gtemplate!="Default"){
            let _template = await game.actors.find(y=>y.data.data.istemplate && y.data.data.gtemplate==gtemplate);
            //console.log(_template);
            if(_template!=null){
                html=_template.data.data._html;
            }

            if(html==null || html=="")
                ui.notifications.warn("Please rebuild template actor");

        }

        if(html==null || html==""){
            console.log("defaulting template");
            gtemplate="Default";
            html = await fetch(this.getHTMLPath(gtemplate)).then(resp => resp.text());

        }

        //console.log(html);
        return html;
    }

    static getHTMLPath(gtemplate){
        let path = "worlds/" + game.data.world.name ;
        //        const path = "systems/sandbox/templates/" + game.data.world + "/";
        var gtemplate = "";

        if(gtemplate==="" || gtemplate==="Default"){
            gtemplate = "character";
            path = "systems/starwars-d6/templates/";
        }

        let templatepath = `${path}/${gtemplate}.html`;
        //console.log(templatepath);

        return templatepath;
    }

    /* -------------------------------------------- */

    static async retrieveBTemplate(){

        var form = await fetch("systems/starwars-d6/templates/character.html").then(resp => resp.text());

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
            if(game.settings.get("starwars-d6", "showADV")) {
                return options.fn(this);
            }
            return options.inverse(this);
        });
    }

    static async registerShowSimpleRoll(){
        Handlebars.registerHelper('showRoller', function(options) {
            if(game.settings.get("starwars-d6", "showSimpleRoller")) {
                return options.fn(this);
            }
            return options.inverse(this);
        });
    }

    static async regParser(expr,attributes,itemattributes){
        let regArray =[];
        let expreg = expr.match(/(?<=\$\<).*?(?=\>)/g);
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

        return expr;
    }

    static async autoParser(expr,attributes,itemattributes,exprmode,noreg=false,number=1){
        var toreturn = expr;
        //console.log(expr);
        //console.log(typeof(expr));
        if(typeof(expr)!="string")
            return expr;

        let diff = await game.settings.get("starwars-d6", "diff");
        if(diff==null)
            diff = 0;
        if(isNaN(diff))
            diff = 0;
        expr = expr.replace(/\#{diff}/g,diff);
        //console.log(itemattributes);
        //console.log(number);
        //console.log(exprmode);

        //PARSE TO TEXT
        let textexpr = expr.match(/[|]/g);
        if(textexpr!=null && (expr.charAt(0)=="|")){
            //console.log("has | ");
            expr = expr.substr(1,expr.length);
            exprmode=true;
        }

        //console.log(exprmode);

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
                regobject.expr = expreg[i].replace(regblocks[0]+";",'');
                //console.log(regobject.expr);
                let internalvBle = regobject.expr.match(/(?<=\$)[0-9]/g);
                if(internalvBle!=null){
                    for (let k=0;k<internalvBle.length;k++){
                        let regindex = internalvBle[k];
                        let regObj = await regArray.find(y=>y.index==regindex);
                        let vbvalue="";
                        if(regObj!=null)
                            vbvalue = regObj.result;
                        regobject.expr = regobject.expr.replace("$"+regindex,vbvalue);
                    }

                }
                //console.log(regobject.expr);

                regobject.result = await auxMeth.autoParser(regobject.expr,attributes,itemattributes,false,true);
                await regArray.push(regobject);

                expr = expr.replace(attname,attvalue);

            }

            let exprparse = expr.match(/(?<=\$)[0-9]+/g);
            if(exprparse!=null){
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

        }

        //console.log(expr);
        //console.log(regArray);

        //Parses last roll
        if(itemattributes!=null && expr.includes("#{roll}")){
            expr=expr.replace("#{roll}",itemattributes._lastroll);
        }

        //Parses number of citems
        if(itemattributes!=null && expr.includes("#{num}")){
            expr=expr.replace("#{num}",number);
        }

        //console.log(expr);
        expr=expr.toString();

        //PARSE ITEM ATTRIBUTES
        var itemresult = expr.match(/(?<=\#\{).*?(?=\})/g);
        if(itemresult!=null && itemattributes!=null){

            //Substitute string for current value
            for (let i=0;i<itemresult.length;i++){
                let attname = "#{" + itemresult[i]+ "}";
                let attvalue;

                if(itemattributes[itemresult[i]]!=null)
                    attvalue = itemattributes[itemresult[i]].value;
                else{
                    //ui.notifications.warn("cItem property " + itemresult[i] + " of cItem " + itemattributes.name +" does not exist");
                    attvalue=0;
                }

                if((attvalue!==false)&&(attvalue!==true)){
                    if((attvalue=="" || attvalue ==null))
                        attvalue=0;
                }

                if(attvalue == null)
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
                    else{
                        let fromcItem = false;
                        let mycitem="";
                        if(itemattributes!=null){
                            fromcItem = true;
                            mycitem = " from citem: " + itemattributes.name;
                        }

                        ui.notifications.warn("Property " + rawattname + mycitem + " does not exist");
                        //console.log(expr);
                    }

                    if((attvalue!==false)&&(attvalue!==true)){
                        if((attvalue=="" || attvalue ==null))
                            attvalue=0;
                    }

                    if(attvalue == null)
                        attvalue=0;

                }
                else{
                    attvalue=0;
                }

                expr = expr.replace(attname,attvalue);
            }         

        }

        //PARSE ITEM ATTRIBUTE
        //console.log(expr);
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
                //console.log(attname + " " + attvalue);
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
                if(attributes!=null){
                    if(attributes[attpresult[i]]!=null)
                        attvalue = attributes[attpresult[i]].value;
                }

                expr = expr.replace(attname,attvalue);
            }         

        }

        //console.log(expr);

        //NEW SMART PARSING
        let sums_are_num = false;
        let safety_break = 0;

        while(!sums_are_num){
            //console.log(expr);
            sums_are_num = true;
            if(safety_break>7)
                break;

            //PARSE SCALED AUTO VALUES
            //var scaleresult = expr.match(/(?<=\%\[).*?(?=\])/g);
            let scmatch = /\%\[/g;
            var scaleresultArray;
            var scaleresult = [];

            while (scaleresultArray = scmatch.exec(expr)) {
                //console.log(maxResultArray.index + ' ' + mrmatch.lastIndex);
                let suba = expr.substring(scmatch.lastIndex, expr.length);
                let subb = auxMeth.getBracketsString(suba);
                scaleresult.push(subb);
            }
            //console.log(scaleresult);
            if(scaleresult!=null && scaleresult.length>0){
                //console.log(expr);
                //Substitute string for current value
                for (let i=scaleresult.length-1;i>=0;i--){
                    let limits = scaleresult[i].split(",");
                    //console.log(limits[0]);
                    let value = limits[0];
                    if(isNaN(value)){
                        let roll = new Roll(limits[0]).roll();
                        value = roll.total;
                    }

                    let valuemod=0;

                    let limitArray = [];

                    for(let j=1;j<limits.length;j++){
                        let splitter = limits[j].split(":");
                        let scale = splitter[0];
                        if(isNaN(scale)){
                            //if(isNaN(scale) || scale.includes('+')|| scale.includes('-')|| scale.includes('/')|| scale.includes('*')){
                            let newroll = new Roll(scale).roll();
                            //expr = expr.replace(scale,newroll.total);
                            scale = newroll.total;

                        }

                        let limitEl = {};
                        limitEl.scale = scale;
                        limitEl.value = splitter[1];
                        await limitArray.push(limitEl);
                    }

                    await limitArray.sort(function (x, y) {
                        return x.scale - y.scale;
                    });
                    //console.log(limitArray);
                    //console.log(value);
                    valuemod= limitArray[0].value;
                    //console.log(valuemod);
                    for(let k=0;k<limitArray.length;k++){
                        let checker = limitArray[k];
                        let checkscale = Number(checker.scale);
                        //console.log(checkscale);
                        if(value>=checkscale){
                            valuemod=checker.value;
                        }
                    }
                    if(isNaN(valuemod)){
                        //console.log(valuemod);
                        let nonum = /[#@]{|\%\[|\if\[/g;
                        let checknonum = valuemod.match(nonum);

                        if(checknonum!=null){
                            sums_are_num = false;
                        }
                    }


                    let attname = "%[" + scaleresult[i]+ "]";
                    expr = expr.replace(attname,valuemod);


                }
                //console.log(expr);

            }



            //console.log(expr);

            //PARSE MAX ROLL
            //var maxresult = expr.match(/(?<=\maxdie\().*?(?=\))/g);
            let mxmatch = /\bmaxdie\(/g;
            var maxdieArray;
            var maxDie = [];

            while (maxdieArray = mxmatch.exec(expr)) {
                //console.log(maxResultArray.index + ' ' + mrmatch.lastIndex);
                let suba = expr.substring(mxmatch.lastIndex, expr.length);
                let subb = auxMeth.getParenthesString(suba);
                maxDie.push(subb);
            }

            if(maxDie!=null){
                for (let i=0;i<maxDie.length;i++){
                    let tochange = "maxdie(" + maxDie[i]+ ")";


                    let newroll = new Roll(maxDie[i]).roll();

                    let attvalue = 0;
                    for(let j=0;j<newroll.dice.length;j++){
                        let diceexp = newroll.dice[j];
                        attvalue += parseInt(diceexp.results.length)*parseInt(diceexp.faces);
                    }


                    expr = expr.replace(tochange,attvalue);
                }
            }

            //MAXOF
            //var maxResult = expr.match(/(?<=\max\().*?(?=\))/g);
            let mrmatch = /\bmax\(/g;
            var maxResultArray;
            var maxResult = [];

            while (maxResultArray = mrmatch.exec(expr)) {
                //console.log(maxResultArray.index + ' ' + mrmatch.lastIndex);
                let suba = expr.substring(mrmatch.lastIndex, expr.length);
                let subb = auxMeth.getParenthesString(suba);
                maxResult.push(subb);
            }

            if(maxResult!=null){
                //Substitute string for current value        
                for (let i=0;i<maxResult.length;i++){

                    let blocks = maxResult[i].split(",");
                    let finalvalue=0;
                    let valueToMax = Array();
                    let nonumber=false;
                    for (let n=0;n<blocks.length;n++){
                        if(!isNaN(blocks[n])){
                            valueToMax.push(parseInt(blocks[n]));
                        }
                        else{
                            nonumber=true;
                        }
                    }
                    if(!nonumber){
                        finalvalue = Math.max.apply(Math, valueToMax);
                        let tochange = "max(" + maxResult[i]+ ")";
                        expr = expr.replace(tochange,parseInt(finalvalue)); 
                    }

                    else{
                        sums_are_num = false;
                    }

                }
            }

            //MINOF
            //var minResult = expr.match(/(?<=\min\().*?(?=\))/g);
            let minmatch = /\bmin\(/g;
            var minResultArray;
            var minResult = [];

            while (minResultArray = minmatch.exec(expr)) {
                //console.log(maxResultArray.index + ' ' + mrmatch.lastIndex);
                let suba = expr.substring(minmatch.lastIndex, expr.length);
                let subb = auxMeth.getParenthesString(suba);
                minResult.push(subb);
            }
            if(minResult!=null){
                //Substitute string for current value        
                for (let i=0;i<minResult.length;i++){
                    //                let debugname = attpresult[i];
                    //                console.log(debugname);

                    let blocks = minResult[i].split(",");
                    let finalvalue;
                    let valueToMin = Array();
                    let nonumber=false;
                    for (let n=0;n<blocks.length;n++){
                        if(!isNaN(blocks[n])){
                            valueToMin.push(parseInt(blocks[n]));
                        }
                        else{
                            nonumber=true;
                        }
                    }
                    if(!nonumber){
                        finalvalue = Math.min.apply(Math, valueToMin);
                        let tochange = "min(" + minResult[i]+ ")";
                        expr = expr.replace(tochange,parseInt(finalvalue)); 
                    }

                    else{
                        sums_are_num = false;
                    }


                }
            }
            //COUNTIF
            //console.log(expr);
            //var countIfResult = expr.match(/(?<=\bcountE\b\().*?(?=\))/g);
            let cifmatch = /\bcountE\(/g;
            var countIfResultArray;
            var countIfResult = [];

            while (countIfResultArray = cifmatch.exec(expr)) {
                //console.log(maxResultArray.index + ' ' + mrmatch.lastIndex);
                let suba = expr.substring(cifmatch.lastIndex, expr.length);
                let subb = auxMeth.getParenthesString(suba);
                countIfResult.push(subb);
            }
            if(countIfResult!=null){
                //Substitute string for current value        
                for (let i=0;i<countIfResult.length;i++){
                    //                let debugname = attpresult[i];


                    let splitter = countIfResult[i].split(";");
                    let comparer = countIfResult[i].replace(splitter[0] + ";",'');
                    let blocks = splitter[0].split(",");
                    let finalvalue=0;
                    let valueIf = Array();
                    let nonumber=false;

                    for (let n=0;n<blocks.length;n++){
                        if(!isNaN(blocks[n])){
                            valueIf.push(parseInt(blocks[n]));
                        }
                        else{
                            nonumber=true;
                        }

                    }

                    if(!nonumber){
                        for(let j=0;j<valueIf.length;j++){
                            //console.log(valueIf[j] + " " + comparer)
                            if(parseInt(valueIf[j])==parseInt(comparer))
                                finalvalue+=1;
                        }

                        let tochange = "countE(" + countIfResult[i]+ ")";
                        expr = expr.replace(tochange,parseInt(finalvalue)); 
                    }

                    else{
                        sums_are_num = false;
                    }


                }
            }
            //console.log(expr);

            //COUNTHIGHER
            //var countHighResult = expr.match(/(?<=\bcountH\b\().*?(?=\))/g);
            let chimatch = /\bcountH\(/g;
            var countHighResultArray;
            var countHighResult = [];

            while (countHighResultArray = chimatch.exec(expr)) {
                //console.log(maxResultArray.index + ' ' + mrmatch.lastIndex);
                let suba = expr.substring(chimatch.lastIndex, expr.length);
                let subb = auxMeth.getParenthesString(suba);
                countHighResult.push(subb);
            }
            if(countHighResult!=null){
                //Substitute string for current value        
                for (let i=0;i<countHighResult.length;i++){
                    //                let debugname = attpresult[i];


                    let splitter = countHighResult[i].split(";");
                    //let comparer = splitter[1];
                    let comparer = countHighResult[i].replace(splitter[0] + ";",'');
                    let blocks = splitter[0].split(",");
                    let finalvalue=0;
                    let valueIf = Array();
                    let nonumber=false;
                    for (let n=0;n<blocks.length;n++){
                        if(!isNaN(blocks[n])){
                            valueIf.push(parseInt(blocks[n]));
                        }
                        else{
                            nonumber=true;
                        }
                    }
                    if(!nonumber){
                        for(let j=0;j<valueIf.length;j++){
                            if(valueIf[j]>comparer)
                                finalvalue+=1;
                        }

                        let tochange = "countH(" + countHighResult[i]+ ")";
                        expr = expr.replace(tochange,parseInt(finalvalue));
                    }

                    else{
                        sums_are_num = false;
                    }


                }
            }

            //COUNTLOWER
            //var countLowResult = expr.match(/(?<=\bcountL\b\().*?(?=\))/g);
            let clomatch = /\bcountL\(/g;
            var countLowResultArray;
            var countLowResult = [];

            while (countLowResultArray = clomatch.exec(expr)) {
                //console.log(maxResultArray.index + ' ' + mrmatch.lastIndex);
                let suba = expr.substring(clomatch.lastIndex, expr.length);
                let subb = auxMeth.getParenthesString(suba);
                countLowResult.push(subb);
            }

            if(countLowResult!=null){
                //Substitute string for current value        
                for (let i=0;i<countLowResult.length;i++){
                    //                let debugname = attpresult[i];


                    let splitter = countLowResult[i].split(";");
                    //let comparer = parseInt(splitter[1]);
                    let comparer = countLowResult[i].replace(splitter[0] + ";",'');
                    let blocks = splitter[0].split(",");
                    let finalvalue=0;
                    let valueIf = Array();

                    let nonumber=false;
                    for (let n=0;n<blocks.length;n++){

                        if(!isNaN(blocks[n])){
                            valueIf.push(parseInt(blocks[n]));
                        }
                        else{
                            nonumber=true;
                        }
                    }
                    if(!nonumber){
                        for(let j=0;j<valueIf.length;j++){
                            if(valueIf[j]<comparer)
                                finalvalue+=1;
                        }

                        let tochange = "countL(" + countLowResult[i]+ ")";
                        expr = expr.replace(tochange,parseInt(finalvalue));
                    }

                    else{
                        sums_are_num = false;
                    }


                }
            }

            //SUM
            //var sumResult = expr.match(/(?<=\bsum\b\().*?(?=\))/g);
            let summatch = /\bsum\(/g;
            var sumResultResultArray;
            var sumResult = [];

            while (sumResultResultArray = summatch.exec(expr)) {
                //console.log(maxResultArray.index + ' ' + mrmatch.lastIndex);
                let suba = expr.substring(summatch.lastIndex, expr.length);
                let subb = auxMeth.getParenthesString(suba);
                sumResult.push(subb);
            }
            if(sumResult!=null){
                //Substitute string for current value        
                for (let i=0;i<sumResult.length;i++){
                    //                let debugname = attpresult[i];


                    let splitter = sumResult[i].split(";");
                    let comparer = splitter[1];
                    let blocks = splitter[0].split(",");
                    let finalvalue=0;
                    let valueIf = Array();
                    let nonumber=false;

                    for (let n=0;n<blocks.length;n++){
                        let nonumsum = /[#@]{|\%\[|\if\[|\?/g;
                        let checknonumsum = blocks[n].match(nonumsum);
                        //console.log(blocks[n])
                        if(!isNaN(blocks[n]) && (checknonumsum==null)){

                            let blocktotal = blocks[n];
                            let arithmparser = /\+|\-|\\|\*/g;
                            let has_arith = blocktotal.match(arithmparser);

                            if(has_arith!=null){
                                try{
                                    let newroll = new Roll(blocks[n]).roll();
                                    blocktotal = newroll.total;
                                }
                                catch(err){

                                }
                            }
                            finalvalue += parseInt(blocktotal);
                        }
                        else{
                            //console.log("nonumber");
                            nonumber=true;
                        }

                    }
                    if(!nonumber){
                        //console.log("replacing")
                        let tochange = "sum(" + sumResult[i]+ ")";
                        expr = expr.replace(tochange,parseInt(finalvalue));
                    }

                    else{
                        sums_are_num = false;
                    }


                }
            }

            //console.log(expr);

            //PARSE CONDITIONAL
            //var ifresult = expr.match(/(?<=\if\[).*?(?=\])/g);
            var ifmatch = /\if\[/g;
            var ifresultArray;
            var ifresult = [];

            while (ifresultArray = ifmatch.exec(expr)) {
                //console.log(maxResultArray.index + ' ' + mrmatch.lastIndex);
                let suba = expr.substring(ifmatch.lastIndex, expr.length);
                let subb = auxMeth.getBracketsString(suba);
                ifresult.push(subb);
            }
            if(ifresult!=null){

                //Substitute string for current value
                for (let i=ifresult.length-1;i>=0;i--){

                    var nonumber = false;
                    let limits = ifresult[i].split(",");
                    let general_cond = limits[0];
                    let truevalue = limits[1];
                    let falsevalue = limits[2];
                    let dontparse = false;
                    falsevalue = falsevalue.replace("ELSE ","");
                    let checknonumcond;
                    let nonumcond;

                    let finalvalue = falsevalue;

                    var findOR = general_cond.search(" OR "); 
                    var findAND = general_cond.search(" AND ");

                    let orconditions;
                    let andconditions;

                    if (findOR != -1){
                        //console.log("OR");
                        orconditions = general_cond.split(" OR ");
                        for(let j=0;j<orconditions.length;j++){
                            let conditions = orconditions[j].split(":");
                            let thiscondition = conditions[0];
                            let checker = conditions[1];

                            if (thiscondition === "true" || thiscondition === "false") {
                                thiscondition = (thiscondition === "true");
                            }

                            if (checker === "true" || checker === "false") {
                                checker = (checker === "true");
                            }

                            if(isNaN(checker)){
                                try{
                                    let newroll = new Roll(checker).roll();
                                    checker = newroll.total;
                                }
                                catch(err){

                                }
                            }

                            if(isNaN(thiscondition)){
                                nonumcond = /\+|\-|\\|\*/g;
                                checknonumcond = thiscondition.match(nonumcond);
                            }


                            if(isNaN(thiscondition) || checknonumcond!=null){
                                try{
                                    let newroll = new Roll(thiscondition).roll();
                                    thiscondition = newroll.total;
                                }
                                catch(err){

                                }
                            }

                            if(thiscondition==checker)
                                finalvalue = truevalue;
                        }
                    }

                    else if (findAND != -1){
                        //console.log("AND");
                        andconditions = general_cond.split(" AND ");
                        finalvalue = truevalue;
                        for(let j=0;j<andconditions.length;j++){
                            let conditions = andconditions[j].split(":");
                            let thiscondition = conditions[0];
                            let checker = conditions[1];

                            if (thiscondition === "true" || thiscondition === "false") {
                                thiscondition = (thiscondition === "true");
                            }

                            if (checker === "true" || checker === "false") {
                                checker = (checker === "true");
                            }

                            if(isNaN(checker)){
                                try{
                                    let newroll = new Roll(checker).roll();
                                    checker = newroll.total;
                                }
                                catch(err){
                                    dontparse = true;

                                }
                            }

                            if(isNaN(thiscondition)){
                                nonumcond = /\+|\-|\\|\*/g;
                                checknonumcond = thiscondition.match(nonumcond);
                            }

                            if(isNaN(thiscondition) || checknonumcond!=null){
                                try{
                                    let newroll = new Roll(thiscondition).roll();
                                    thiscondition = newroll.total;
                                }
                                catch(err){
                                    dontparse = true;
                                }
                            }

                            //console.log(thiscondition + " " + checker);

                            if(thiscondition!=checker)
                                finalvalue = falsevalue;
                        }
                    }

                    else {
                        //console.log("NONE");
                        let conditions = general_cond.split(":");
                        let thiscondition = conditions[0];
                        let checker = conditions[1];

                        if (thiscondition === "true" || thiscondition === "false") {
                            thiscondition = (thiscondition === "true");
                        }

                        if (checker === "true" || checker === "false") {
                            checker = (checker === "true");
                        }

                        //console.log(thiscondition + " " + checker);

                        if(isNaN(checker)){
                            try{
                                let newroll = new Roll(checker).roll();
                                checker = newroll.total;
                            }
                            catch(err){
                                dontparse = true;
                            }
                        }

                        if(isNaN(thiscondition)){
                            nonumcond = /\+|\-|\\|\*/g;
                            checknonumcond = thiscondition.match(nonumcond);
                        }

                        if(isNaN(thiscondition) || checknonumcond!=null){
                            try{
                                let newroll = new Roll(thiscondition).roll();
                                thiscondition = newroll.total;
                            }
                            catch(err){
                                dontparse = true;
                            }
                        }

                        //console.log(thiscondition + " " + checker);

                        if(thiscondition .toString() === checker.toString()){
                            finalvalue = truevalue;
                        }
                    }

                    //console.log(finalvalue);

                    let attname = "if[" + ifresult[i]+ "]";

                    let nonum = /[#@]{|\%\[|\if\[|\?/g;
                    let checknonumtrue = falsevalue.match(nonum);
                    let checknonumfalse = truevalue.match(nonum);

                    if(checknonumtrue!=null || checknonumfalse!=null){
                        sums_are_num = false;
                    }

                    else{
                        expr = expr.replace(attname,finalvalue);
                    }

                }         

            }

            //console.log(expr);
            //MATH and ARITHMETIC CORRECTIONS
            let plusmin = /\+\-/g;
            expr = expr.replace(plusmin,"-");
            let minmin = /\-\-/g;
            expr = expr.replace(minmin,"+");

            //console.log(expr);

            safety_break += 1;

        }

        //console.log(expr);
        //console.log(exprmode);

        //console.log("finished parsed")
        //console.log(expr);

        toreturn = expr;



        if(isNaN(expr)){
            //console.log("nonumber");
            if(!exprmode){
                //console.log("exprmode=false")
                try{
                    let final = new Roll(expr);

                    final.roll();
                    //console.log(final);

                    if(isNaN(final.total)||final.total==null||final.total===false)
                    {
                        toreturn = expr;
                    }
                    else{
                        toreturn = final.total;
                    }

                    //console.log(toreturn);
                }
                catch(err){
                    //console.log("Following Roll expression can not parse to number. String returned");
                    //console.log(expr);
                    //ui.notifications.warn("Roll expression can not parse to number");
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
        else{
            if(exprmode)
                toreturn = expr;
        }
        //console.log(toreturn);
        return toreturn;
    }

    static getParenthesString(expr){
        let openpar = 0;
        let closedpar = -1;
        let parsed = false;
        let finalexpr = "";

        for(let i=0;i<expr.length;i++){
            if(!parsed){
                if(expr.charAt(i)==='(')
                    openpar +=1;
                if(expr.charAt(i)===')')
                    closedpar +=1;

                if(openpar == closedpar){
                    parsed = true;
                }
                else{
                    finalexpr += expr.charAt(i);
                }

            }

        }

        return finalexpr;
    }

    static getBracketsString(expr){
        let openpar = 0;
        let closedpar = -1;
        let parsed = false;
        let finalexpr = "";

        for(let i=0;i<expr.length;i++){
            if(!parsed){
                if(expr.charAt(i)==='[')
                    openpar +=1;
                if(expr.charAt(i)===']')
                    closedpar +=1;

                if(openpar == closedpar){
                    parsed = true;
                }
                else{
                    finalexpr += expr.charAt(i);
                }

            }

        }

        return finalexpr;
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

        if(!game.settings.get("starwars-d6", "showLastRoll"))
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

