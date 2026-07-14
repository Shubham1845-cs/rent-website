const dns = require("node:dns").promises;

console.log("Starting DNS test...");

(async () => {
    try {
        const records = await dns.resolveSrv(
            "_mongodb._tcp.rentflatmate-cluster.7imhnac.mongodb.net"
        );

        console.log("✅ SRV Records:");
        console.log(records);
    } catch (err) {
        console.error("❌ DNS Error:");
        console.error(err);
    } finally {
        console.log("Finished.");
    }
})();