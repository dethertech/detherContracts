# you don't need a local node, just assure you there's enough kovan on the account

## to migrate    
`truffle migrate --network kovan --reset`   
stop after 'saving artifacts'

## to run test    
`truffle test`   

## to upgrade npm packages    
https://www.npmjs.com/package/dethercontract
https://www.npmjs.com/~dether.io


`cd build`
`npm adduser`
`npm version patch`   
`npm publish`    


# TO DO    
Improve contract: when a teller register in a new zone, find a way to delete him from his last zone.
