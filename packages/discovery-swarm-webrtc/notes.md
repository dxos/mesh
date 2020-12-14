## Notes on field issues with WebRTC swarm

### TURN Server configuration invalid or TURN server not functioning

WebRTC ICE for non-NAT-traversal scenarios (which I think includes any test from my network and probably many others) failing. 
This was due to a mistake in the ICE config that led to the TURN server hosted at GCP being used rather than the 
kube-hosted server. When we stopped the servers at GCP last week it would have stopped working. 
The config mistake was I assume some misunderstanding about how our config scheme is intended to be used -- the Teamwork app was 
overriding the kube-supplied config. Possibly a dev-deployment config setting that crept into production. I also found in 
subsequent testing that the TURN server on one of the apollos was not running (had exited). 
I've restarted it but obviously there is a need to make that server auto-re-starting or otherwise enhance its reliability.

