/* [Compliance Audit Checklist]
1. 语法检查: Node.js 18 兼容性 √
2. 逻辑完整: 保留 SS-DEEP-CLEAN 与 YAML 导出 √
3. 冲突消除: 物理删除重复的 run() 调用，解决 Code 8 √
*/

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MEET_DIR = path.join(__dirname, 'Meet');
const OUTPUT_FILE = 'Candidate.json';
const YAML_OUTPUT_FILE = 'Candidate_config.yaml';

function safeBase64Decode(str) {
    try {
        const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(normalized, 'base64').toString('utf8');
    } catch (e) { return str; }
}

function parseProtocolLink(link) {
    try {
        const line = link.trim();
        if (!line || !line.includes('://')) return null;

        if (line.startsWith('vmess://')) {
            const n = JSON.parse(safeBase64Decode(line.replace('vmess://', '')));
            return {
                fp: `VMESS-${n.add}-${n.port}-${n.path || ''}`,
                data: { type: 'VMESS', address: n.add, port: parseInt(n.port), id: n.id, aid: parseInt(n.aid) || 0, net: n.net || "tcp", path: n.path || "", tls: n.tls || "", sni: n.sni || n.host || "" }
            };
        }

        const u = new URL(line);
        const protocol = u.protocol.replace(':', '').toUpperCase();
        const params = {};
        u.searchParams.forEach((v, k) => { params[k] = v; });

        let nodeData = {
            type: protocol, address: u.hostname, port: parseInt(u.port),
            net: params.type || params.net || "tcp", path: params.path || u.pathname || "",
            security: params.security || (u.port === "443" ? "tls" : "none"),
            sni: params.sni || params.host || u.hostname, pbk: params.pbk || "", sid: params.sid || "", flow: params.flow || ""
        };

        if (protocol === 'SS') {
            if (u.username) {
                const decoded = safeBase64Decode(u.username);
                if (decoded.includes(':')) {
                    const [method, password] = decoded.split(':');
                    nodeData.method = method;
                    nodeData.password = password;
                }
            }
            delete nodeData.id; // 物理去泥
        } else {
            nodeData.id = u.username || params.id || "";
            nodeData.password = u.username || params.password || "";
        }

        if (isNaN(nodeData.port) || nodeData.port <= 0) return null;
        return { fp: `${protocol}-${nodeData.address}-${nodeData.port}`, data: nodeData };
    } catch (e) { return null; }
}

function generateClashYaml(nodes) {
    let yaml = "proxies:\n";
    nodes.forEach((n, i) => {
        const name = `Node-${n.index}`;
        if (n.type === 'VMESS') {
            yaml += `  - {name: "${name}", type: vmess, server: ${n.address}, port: ${n.port}, uuid: ${n.id}, alterId: ${n.aid}, cipher: auto, network: ${n.net}, ws-opts: {path: ${n.path}}, tls: ${n.tls?true:false}, skip-cert-verify: true, sni: ${n.sni}}\n`;
        } else if (n.type === 'SS') {
            yaml += `  - {name: "${name}", type: ss, server: ${n.address}, port: ${n.port}, cipher: ${n.method}, password: ${n.password}}\n`;
        }
    });
    yaml += "\nproxy-groups:\n  - {name: \"🚀 节点选择\", type: select, proxies: [\"DIRECT\"]}\nrules:\n  - MATCH,DIRECT\n";
    return yaml;
}

// 核心执行逻辑：唯一入口，严禁重复调用！
async function main() {
    console.log("🚀 [小七] 启动修正版引擎...");
    if (!fs.existsSync(MEET_DIR)) fs.mkdirSync(MEET_DIR);
    
    const nodesMap = new Map();
    const files = fs.readdirSync(MEET_DIR).filter(f => f.endsWith('.txt'));
    
    for (const file of files) {
        const content = fs.readFileSync(path.join(MEET_DIR, file), 'utf8');
        let effective = content.includes('://') ? content : safeBase64Decode(content);
        effective.split(/\r?\n/).forEach(line => {
            const res = parseProtocolLink(line);
            if (res) nodesMap.set(res.fp, res.data);
        });
    }

    const finalNodes = Array.from(nodesMap.values()).map((n, i) => { n.index = i + 1; return n; });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalNodes, null, 2));
    fs.writeFileSync(YAML_OUTPUT_FILE, generateClashYaml(finalNodes));
    console.log(`🎉 炼化完成: ${finalNodes.length} 条精锐。`);
}

main().catch(err => {
    console.error("🔥 崩溃详情:", err);
    process.exit(1);
});
