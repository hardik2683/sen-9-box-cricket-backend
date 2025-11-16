const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    fname:{
        type:String,
        require:true
    },
    lname:{
        type:String,
        require:true
    },
    email:{
        type:String,
        require:true
    },
    mobile:{
        type:Number,
        require:true
    },
    rating:{
        type:String,
        enum:['Excellent','Very Good','Good','Bad'],
        default:'Male'
    },
    query:{
        type:String,
        require:true
    },
    
})


module.exports = mongoose.model('Feedback',userSchema)