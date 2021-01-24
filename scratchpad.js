/*
[2d + 2d - 1d + 1], i = 0
 ^
[2d + 2d - 1d + 1], i = 1
    ^
[4d - 1d + 1], i = 1
    ^
[3d + 1], i = 1
    ^
*/

// let initial = ['2d', '+', '2d', '-', '1d', '+', 1]
let initial = [1, '+', 2, '+', '2d', '+', '2d']



for (let i = 0; i < initial.length; i++) {
   const el = initial[i]

   if (el === '+' || el === '-') {
      let left = initial[i - 1]
      let right = initial[i + 1]

      if (typeof left === 'string' && left.endsWith('d') && typeof right === 'string' && right.endsWith('d')) {
         if (el === '+') {
            initial.splice(i - 1, 3, (Number.parseInt(left) + Number.parseInt(right)) + 'd')
         } else if (el === '-') {
            initial.splice(i - 1, 3, (Number.parseInt(left) - Number.parseInt(right) + 'd'))
         }
         --i
      }
   }

}


console.log(initial)