/* [Strict Maintenance Mode] 
Part Name: DataWashClean_V4.0_Intelligence_Audit
Task: Node Extraction & Link Triage (Discard t.me, Keep Others)
Compliance: Gemini Development Protocol (Zero Omission, No Truncation)
*/

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MEET_DIR = path.join(__dirname, 'Meet');
const OUTPUT_FILE = 'Candidate.json';
const YAML_OUTPUT_FILE = 'Candidate_config.yaml';
const HINT_MAYBE_FILE = 'hint-maybeuseful.yml';

/**
 * 像素级安全解码：物理剔除不可见字符与空字符
 */
function safeBase64Decode(str) {
    try {
        const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(normalized, 'base64').toString('utf8').replace(/\0/g, '');
    } catch (e) { return str; }
}

/**
 * 协议解析核心：处理各协议并执行 AD/广告物理清洗
 */
function parseProtocolLink(link) {
    try {
        const line = link.trim();
        if (!line || !line.includes('://')) return null;

        // 1. VMESS 像素级解析
        if (line.startsWith('vmess://')) {
            const raw = line.replace('vmess://', '');
            const n = JSON.parse(safeBase64Decode(raw));
            // 物理清洗非法地址 (Node-8 案例修复)
            const addr = n.add.toLowerCase();
            if (addr.includes('github') || addr.includes('http') || addr.length > 80) return null;

            return {
                fp: `VMESS-${n.add}-${n.port}-${n.path || ''}`,
                data: { type: 'VMESS', address: n.add, port: parseInt(n.port), id: n.id, aid: parseInt(n.aid) || 0, net: n.net || "tcp", path: n.path || "", tls: n.tls || "", sni: n.sni || n.host || "" }
            };
        }

        // 2. 通用解析逻辑 (SS/VLESS/Trojan)
        const u = new URL(line);
        const protocol = u.protocol.replace(':', '').toUpperCase();
        
        // 物理清洗非法地址
        const addr = u.hostname.toLowerCase();
        if (addr.includes('github') || addr.includes('http') || addr.length > 80) return null;

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
                    const parts = decoded.split(':');
                    nodeData.method = parts[0];
                    // 物理切除密码乱码尾部
                    nodeData.password = parts[1].replace(/[^\x20-\x7E]/g, '');
                }
            }
        } else {
            nodeData.id = u.username || params.id || "";
            nodeData.password = u.username || params.password || "";
        }

        if (isNaN(nodeData.port) || nodeData.port <= 0) return null;
        return { fp: `${protocol}-${nodeData.address}-${nodeData.port}`, data: nodeData };
    } catch (e) { return null; }
}

/**
 * 炼化厂主程序：集成三级分流逻辑
 */
async function main() {
    console.log("🛠️ [小七] 炼化厂 V4.0 启动，正在执行像素级审计...");
    
    const nodesMap = new Map();
    const maybeUsefulSet = new Set();
    
    if (!fs.existsSync(MEET_DIR)) {
        console.log("❌ 错误：未发现 Meet 文件夹。");
        return;
    }

    const files = fs.readdirSync(MEET_DIR).filter(f => f.endsWith('.txt'));
    
    files.forEach(file => {
        const content = fs.readFileSync(path.join(MEET_DIR, file), 'utf8');
        // 解码逻辑保护
        let effective = (content.includes('://') || content.length < 50) ? content : safeBase64Decode(content);
        
        effective.split(/\r?\n/).forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return;

            // --- 分流逻辑 1: 协议解析 ---
            const res = parseProtocolLink(cleanLine);
            if (res) {
                nodesMap.set(res.fp, res.data);
                return;
            }

            // --- 分流逻辑 2: 情报审计 (非协议链接处理) ---
            if (cleanLine.startsWith('http')) {
                // A. 物理切除 t.me 链接 (广告/垃圾)
                if (cleanLine.includes('t.me')) return;

                // B. 记录其余有用链接 (例如 github 分享)
                maybeUsefulSet.add(cleanLine);
            }
        });
    });

    // 1. 导出 Candidate 成果
    const finalNodes = Array.from(nodesMap.values()).map((n, i) => { n.index = i + 1; return n; });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalNodes, null, 2));

    // 2. 导出 YAML 配置文件
    let yaml = "proxies:\n";
    finalNodes.forEach(n => {
        const name = `Node-${n.index}`;
        if (n.type === 'VMESS') {
            yaml += `  - {name: "${name}", type: vmess, server: ${n.address}, port: ${n.port}, uuid: ${n.id}, alterId: ${n.aid}, cipher: auto, network: ${n.net}, ws-opts: {path: "${n.path}"}, tls: ${n.tls?true:false}, skip-cert-verify: true, sni: "${n.sni}"}\n`;
        } else if (n.type === 'SS') {
            yaml += `  - {name: "${name}", type: ss, server: ${n.address}, port: ${n.port}, cipher: ${n.method}, password: "${n.password}"}\n`;
        }
    });
    yaml += "\nproxy-groups:\n  - {name: \"🚀 节点选择\", type: select, proxies: [\"DIRECT\"]}\nrules:\n  - MATCH,DIRECT\n";
    fs.writeFileSync(YAML_OUTPUT_FILE, yaml);

    // 3. 导出情报文件 (一链接一行)
    if (maybeUsefulSet.size > 0) {
        const hintContent = Array.from(maybeUsefulSet).map(link => `- ${link}`).join('\n');
        fs.writeFileSync(HINT_MAYBE_FILE, `# 炼化厂情报存档\n# 排除 t.me 后的剩余资产\n\n${hintContent}`);
    }

    console.log(`✅ 炼化完成！`);
    console.log(`💎 核心节点：${finalNodes.length} 条`);
    console.log(`🔍 潜在情报：${maybeUsefulSet.size} 条 (已剔除 t.me)`);
}

main().catch(err => { console.error(err); process.exit(1); });
