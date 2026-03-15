const express = require('express');




const userRouter = require('./routes/user');

const iotaRouter = require('./routes/iota');

const app = express();


app.use(express.json());


app.get("/",(req,res)=>{
    res.send("Hello, World!");
})

app.use("/iota", iotaRouter);

app.use("/user",userRouter);





app.listen(9000,()=> console.log("Server started!!!"));