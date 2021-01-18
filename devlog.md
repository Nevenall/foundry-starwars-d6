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
