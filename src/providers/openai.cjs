'use strict';
async function read(context){
 if(!context.readOpenAiBalance)throw new Error('openai_login');
 return context.readOpenAiBalance();
}
module.exports={id:'openai',name:'OpenAI API',icon:'openai',display:'balance',read};
