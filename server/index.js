const express = require('express');

const app = express();

const userRouter = require('./routes/user');

app.get("/",(req,res)=>{
    res.send("Hello, World!");
})

app.use("/user",userRouter);



app.listen(9000,()=> console.log("Server started!!!"));