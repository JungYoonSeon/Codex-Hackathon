import {randomBytes} from 'node:crypto';
import {AppError} from './errors.ts';
/** Public app bootstrap: short-lived per-install guest capabilities, never the operator token or API key. */
export function createGuestSessions() {
  const sessions=new Map<string,{expiresAt:number;windowStart:number;requests:number}>();
  const issues=new Map<string,{at:number;count:number}>();
  const ttl=30*60*1000;
  function clean(now:number){for(const [id,s] of sessions)if(s.expiresAt<=now)sessions.delete(id);for(const [ip,s] of issues)if(now-s.at>=3600000)issues.delete(ip);}
  return {
    issue(ip:string){
      const now=Date.now();clean(now);
      const rate=issues.get(ip)??{at:now,count:0};
      if(rate.count>=12||sessions.size>=2000)throw new AppError(429,'RATE_LIMITED','Too many connection attempts. Please try again later.',true);
      rate.count++;issues.set(ip,rate);
      const token=randomBytes(32).toString('base64url'),expiresAt=now+ttl;
      sessions.set(token,{expiresAt,windowStart:now,requests:0});return {token,expiresAt};
    },
    authorize(token:string){
      const now=Date.now(),session=sessions.get(token);
      if(!session||session.expiresAt<=now){sessions.delete(token);return false;}
      if(now-session.windowStart>=60000){session.windowStart=now;session.requests=0;}
      if(session.requests>=120)throw new AppError(429,'RATE_LIMITED','Too many requests. Please try again shortly.',true);
      session.requests++;return true;
    },
  };
}
