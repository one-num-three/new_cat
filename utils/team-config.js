// UI validation mirrors authoritative pilot-0.3 server rules; never decides roles/winner.
function validate(total,cats,mice){
 if(![total,cats,mice].every(Number.isInteger))return '人数请填写整数';
 if(total<2||total>60)return '总人数请填写2–60人';
 if(cats<1||mice<1)return '猫和鼠至少各1人';
 if(cats+mice!==total)return '猫人数 + 鼠人数必须等于总人数';
 return '';
}
module.exports={validate};
