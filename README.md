## you don't need a local node, just assure you there's enough kovan on the account

# to migrate    
`truffle migrate --network kovan --reset`   
stop after 'saving artifacts'

# to run test    
`truffle test`   

# to upgrade npm packages    
https://www.npmjs.com/package/dethercontract    

`cd build`   
`npm version patch`   
`npm publish`    
