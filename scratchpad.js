let exp = /^([0-9]+)?[dD]([A-z]|[0-9]+)([^ (){}[\]+\-*/]+)?(?:\[([^\]]+)\])?$/


let match = "4d6x".match(exp)

console.log(match)