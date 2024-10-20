const getVideos = (req,res,handleErr)=>{

  const name = req.params.get("name")


  if(name) {
    res.json({message:`Your name is ${name}` })
  } else{
    return handleErr({status:400,message:"Please specify a name"})
  }
}

const controller = {
  getVideos,
}

module.exports = controller