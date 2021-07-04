# Devlog for Starwars 

Todo - Character's don't seem to be saving correctly.

just need a simple attribute and and skill sheet
be nice if you can click and roll on a skill. 


## 1.17.2021, danb
 
Wild dice

everytime you roll dice one of them is wild, which means:

- it explodes on a 6
- on a 1 it either removes itself and your highest die roll, or the gm may say there is a complication instead. 

Also, dice from character points just explode on 6. 

so, we could do it manually, 2d = 1w1d that sounds awkward
but maybe we can listen for the 4d+1 style rolls and translate them. 

/r {1d6x}+{3d6} we can translate the formula 

also, don't collapse dice rolls, hate that. 

## 1.24.2021, danb

ok, looks like we need to do some work to deal with some stages. 

identify terms gets called 3 times to generate dice from the expression
then after we update stuff the expression gets regenerated from the dice terms
and then we AGAIN identify terms from that reparsed expression. 
Some of this comes from sending the roll info to the client, but damn. 

## 5.5.2021, danb

foundry 8.2 is out. can adjust things for that

vs code allows us to create compound launch configs https://code.visualstudio.com/docs/editor/debugging#_compound-launch-configurations
so we can attach to foundry and chrome. Get both server and client.
we could also configure the foundry launch command. 

## 7.3.2021, danb

Ok, we can't really do a custom DiceTerm because of all the uses of that explicit type. 
I think the Roll class is the overall management class. I think, so it can switch from using the DiceTerm.matchTerm class to do it's own special matching.
we can try the default matching and it doesn't work, we'll do our matching.