"use strict";
/**
 * 基于图的IR，用于中端的优化算法。
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphPainter = exports.IRGenerator = exports.IRModule = exports.LoopExit = exports.LoopEnd = exports.LoopBegin = exports.MergeNode = exports.EndNode = exports.BeginNode = exports.IfNode = exports.ReturnNode = exports.StartNode = exports.FunctionNode = exports.AbstractMergeNode = exports.AbstractEndNode = exports.AbstractBeginNode = exports.UniSuccessorNode = exports.ControlNode = exports.PhiNode = exports.UnaryOpNode = exports.BinaryOpNode = exports.ConstantNode = exports.ParameterNode = exports.TerminalNode = exports.DataNode = exports.IRNode = exports.Graph = void 0;
const symbol_1 = require("./symbol");
const scanner_1 = require("./scanner");
const ast_1 = require("./ast");
const console_1 = require("console");
//IR图
class Graph {
    constructor() {
        //所有节点的列表
        this.nodes = [];
        //笑一个节点的序号
        this.nextIndex = 0;
        //变量跟Node的映射
        this.varProxy2Node = new Map();
    }
    //如果没有同样的节点，就添加进去。否则，就返回原来的节点
    addDataNode(node) {
        for (let node1 of this.nodes) {
            if (node1 instanceof DataNode && node1.equals(node)) {
                return node1;
            }
        }
        this.nodes.push(node);
        node.index = this.nextIndex++;
        return node;
    }
    addControlNode(node) {
        this.nodes.push(node);
        node.index = this.nextIndex++;
        return node;
    }
    //添加对象的定义，返回一个proxy
    addVarDefinition(varSym, node) {
        let index = 0;
        for (let proxy of this.varProxy2Node.keys()) {
            if (proxy.varSym == varSym) {
                index++;
            }
        }
        let proxy = new VarProxy(varSym, index);
        this.varProxy2Node.set(proxy, node);
        return proxy;
    }
    getParameterNode(name) {
        for (let node of this.nodes) {
            if (node instanceof ParameterNode && node.name_ == name) {
                return node;
            }
        }
        return null;
    }
}
exports.Graph = Graph;
//代表了变量的一次定义。每次变量重新定义，都会生成一个新的Proxy，以便让IR符合SSA格式
class VarProxy {
    constructor(varSym, index) {
        this.varSym = varSym;
        this.index = index;
    }
}
//////////////////////////////////////////////////////////////////////////
//HIR  抽象度比较高的IR，接近高级语言的特性
//基类
class IRNode {
    constructor() {
        //当前节点在图中的序号
        this.index = -1; //未被正式赋值前，为-1
    }
}
exports.IRNode = IRNode;
//-------DataNodes--------
//数据流节点的基类
class DataNode extends IRNode {
    constructor(theType) {
        super();
        //使用该节点的节点，形成use-def链,自动维护
        this.uses = [];
        this.varSyms = []; //这个节点是哪些变量的定义
        this.theType = theType;
    }
}
exports.DataNode = DataNode;
//端点，没有successor，比如变量和常量
class TerminalNode extends DataNode {
    get inputs() {
        return [];
    }
}
exports.TerminalNode = TerminalNode;
//参数
class ParameterNode extends TerminalNode {
    constructor(name, theType) {
        super(theType);
        this.name_ = name;
    }
    get label() {
        return this.name_ + "_" + this.index;
    }
    toString() {
        return this.label;
    }
    equals(node) {
        if (node instanceof ParameterNode) {
            return node.name_ == this.name_;
        }
        return false;
    }
}
exports.ParameterNode = ParameterNode;
//常量
class ConstantNode extends TerminalNode {
    constructor(value, theType) {
        super(theType);
        this.value = value;
    }
    get label() {
        return "C_" + this.value + "_" + this.index;
    }
    toString() {
        return this.label;
    }
    equals(node) {
        if (node instanceof ConstantNode) {
            return node.value == this.value;
        }
        return false;
    }
}
exports.ConstantNode = ConstantNode;
//二元运算节点
class BinaryOpNode extends DataNode {
    constructor(left, right, op, theType) {
        super(theType);
        this.left = left;
        this.right = right;
        this.op = op;
        //自动建立双向的use-def链
        left.uses.push(this);
        right.uses.push(this);
    }
    get label() {
        return scanner_1.Op[this.op] + "_" + this.index;
    }
    toString() {
        return this.label + "(left->" + this.left.label + ",right->" + this.right.label + ")";
    }
    get inputs() {
        return [this.left, this.right];
    }
    equals(node) {
        if (node instanceof BinaryOpNode) {
            return this.op == node.op && this.left.equals(node.left) && this.right.equals(node.right);
        }
        return false;
    }
}
exports.BinaryOpNode = BinaryOpNode;
//一元运算节点
class UnaryOpNode extends DataNode {
    constructor(data, op, isPrefix, theType) {
        super(theType);
        this.data = data;
        this.op = op;
        this.isPrefix = isPrefix;
        //自动建立双向的use-def链
        data.uses.push(this);
    }
    get label() {
        return scanner_1.Op[this.op] + "_" + this.index;
    }
    toString() {
        return this.label
            + "(" + (this.isPrefix ? "prefix" : "postfix")
            + ",data->" + this.data.label
            + ")";
    }
    get inputs() {
        return [this.data];
    }
    equals(node) {
        if (node instanceof UnaryOpNode) {
            return this.op == node.op && this.isPrefix == node.isPrefix && this.data.equals(node.data);
        }
        return false;
    }
}
exports.UnaryOpNode = UnaryOpNode;
class PhiNode extends DataNode {
    constructor(mergeNode, inputs, theType) {
        super(theType);
        this.mergeNode = mergeNode;
        this.inputs_ = inputs;
    }
    get inputs() {
        return this.inputs_;
    }
    get label() {
        return "PhiNode" + "_" + this.index;
    }
    toString() {
        // let str="inputs:";
        // for (let )
        return this.label; //todo
    }
    equals(node) {
        if (node instanceof PhiNode) {
            if (node.mergeNode == this.mergeNode && node.inputs_.length == this.inputs_.length) {
                for (let input of node.inputs_) {
                    if (this.inputs_.indexOf(input) == -1)
                        return false;
                }
                return true;
            }
        }
        return false;
    }
}
exports.PhiNode = PhiNode;
//-------ControlNodes--------
//控制流节点的基类
class ControlNode extends IRNode {
    constructor() {
        super(...arguments);
        //前序节点列表,被自动维护
        this.predecessor = null;
    }
    //获取这条控制流的开头节点，可以是一个Begin节点，或者是一个AbsctractMerge节点
    get beginNode() {
        if (this instanceof AbstractBeginNode) {
            return this;
        }
        else {
            return this.predecessor.beginNode;
        }
    }
}
exports.ControlNode = ControlNode;
class UniSuccessorNode extends ControlNode {
    constructor(next) {
        super();
        this.next_ = next;
        this.next_.predecessor = this;
    }
    get next() {
        return this.next_;
    }
    set next(newNode) {
        this.next_ = newNode;
        this.next_.predecessor = this;
    }
    get successors() {
        return [this.next];
    }
}
exports.UniSuccessorNode = UniSuccessorNode;
class AbstractBeginNode extends UniSuccessorNode {
}
exports.AbstractBeginNode = AbstractBeginNode;
class AbstractEndNode extends ControlNode {
    get successors() {
        return [];
    }
    toString() {
        return this.label;
    }
}
exports.AbstractEndNode = AbstractEndNode;
class AbstractMergeNode extends AbstractBeginNode {
    constructor(inputs, next) {
        super(next);
        this.inputs = inputs;
    }
    toString() {
        let str = "(";
        for (let i = 0; i < this.inputs.length; i++) {
            let node = this.inputs[i];
            str += node.label;
            if (i < this.inputs.length - 1)
                str += ",";
        }
        str += ")";
        return this.label + str;
    }
}
exports.AbstractMergeNode = AbstractMergeNode;
//函数节点
class FunctionNode extends AbstractBeginNode {
    constructor(name, params, next) {
        super(next);
        this.name_ = name;
        this.params = params;
    }
    get label() {
        return this.name_ + "_" + this.index;
    }
    toString() {
        let paramStr = "(";
        for (let i = 0; i < this.params.length; i++) {
            let param = this.params[i];
            paramStr += param.label;
            if (i < this.params.length - 1)
                paramStr += ",";
        }
        paramStr += ")";
        return this.label + paramStr;
    }
}
exports.FunctionNode = FunctionNode;
//函数开始节点
class StartNode extends AbstractBeginNode {
    get label() {
        return "Start" + "_" + this.index;
    }
    toString() {
        return this.label + "(->" + this.next.label + ")";
    }
}
exports.StartNode = StartNode;
//退出函数的节点
class ReturnNode extends AbstractEndNode {
    constructor(value) {
        super();
        this.value = null; //返回值
        this.value = value;
    }
    get label() {
        return "ReturnNode" + "_" + this.index;
    }
    toString() {
        var _a;
        return this.label + (this.value ? "(value->" + ((_a = this.value) === null || _a === void 0 ? void 0 : _a.label) + ")" : "");
    }
}
exports.ReturnNode = ReturnNode;
//if节点
class IfNode extends ControlNode {
    constructor(condition, thenBranch, elseBranch) {
        super();
        this.condition = condition;
        this.trueBranch = thenBranch;
        this.falseBranch = elseBranch;
        thenBranch.predecessor = this;
        elseBranch.predecessor = this;
    }
    get label() {
        return "If" + "_" + this.index;
    }
    toString() {
        var _a;
        return this.label
            + "(condition->" + this.condition.label
            + ", then->" + this.trueBranch.label
            + (this.falseBranch ? ", else->" + ((_a = this.falseBranch) === null || _a === void 0 ? void 0 : _a.label) : "")
            + ")";
    }
    get successors() {
        if (this.falseBranch)
            return [this.trueBranch, this.falseBranch];
        else
            return [this.trueBranch];
    }
}
exports.IfNode = IfNode;
class BeginNode extends AbstractBeginNode {
    get label() {
        return "Begin" + "_" + this.index;
    }
    toString() {
        return this.label + "(->" + this.next.label + ")";
    }
}
exports.BeginNode = BeginNode;
class EndNode extends AbstractEndNode {
    get label() {
        return "End" + "_" + this.index;
    }
}
exports.EndNode = EndNode;
class MergeNode extends AbstractMergeNode {
    get label() {
        return "Merge" + "_" + this.index;
    }
}
exports.MergeNode = MergeNode;
class LoopBegin extends AbstractMergeNode {
    get label() {
        return "LoopBegin" + "_" + this.index;
    }
}
exports.LoopBegin = LoopBegin;
class LoopEnd extends AbstractEndNode {
    constructor(loopBegin) {
        super();
        this.loopBegin = loopBegin;
    }
    get label() {
        return "LoopEnd" + "_" + this.index;
    }
}
exports.LoopEnd = LoopEnd;
class LoopExit extends AbstractEndNode {
    constructor(loopBegin) {
        super();
        this.loopBegin = loopBegin;
    }
    get label() {
        return "LoopExit" + "_" + this.index;
    }
}
exports.LoopExit = LoopExit;
//用作占位符，用于创建IR图的过程中
class FakeControlNode extends ControlNode {
    get label() {
        return "Fake" + "_" + this.index;
    }
    toString() {
        return this.label;
    }
    get successors() {
        return [];
    }
}
///////////////////////////////////////////////////////////////////////////
//从AST生成IR
//保存函数和Graph之间的关联关系
class IRModule {
    constructor() {
        this.fun2Graph = new Map();
    }
    //打印输出
    dump() {
    }
}
exports.IRModule = IRModule;
class IRGenerator extends ast_1.AstVisitor {
    constructor(module) {
        super();
        //-------解析过程中的上下文信息----------
        //上下文信息：Graph
        this._graphs = [];
        //上下文信息：当前
        this._funcitonSyms = [];
        //对每个变量维护一个栈，从而知道当前代码用到的是变量的哪个定义
        //存储方式：VarProxy跟作用域绑定。在同一个作用域里，如果有多个定义，则后面的定义会替换掉前面的。
        this.varProxyMap = new Map();
        this.module = module;
    }
    get graph() {
        return this._graphs[this._graphs.length - 1];
    }
    get functionSym() {
        return this._funcitonSyms[this._funcitonSyms.length - 1];
    }
    setVarProxyForFlow(beginNode, varSym, proxy) {
        if (!this.varProxyMap.has(beginNode)) {
            this.varProxyMap.set(beginNode, new Map());
        }
        let map = this.varProxyMap.get(beginNode);
        map.set(varSym, proxy);
    }
    //从本级以及上级中获取varProxy, 如果遇到merge节点就停下，因为merge节点不能上溯
    getVarProxyFromFlow(beginNode, varSym) {
        let map = this.varProxyMap.get(beginNode);
        let varProxy = null;
        if (map && map.has(varSym))
            varProxy = map.get(varSym);
        if (!varProxy && beginNode.predecessor) {
            let parentFlow = beginNode.predecessor.beginNode; //如果beginNode是if的一个分支，现在会上到外层的控制流
            varProxy = this.getVarProxyFromFlow(parentFlow, varSym);
        }
        return varProxy;
    }
    //-------override vistXXX()----------
    visitProg(prog, additional) {
        //设置上下文
        this._graphs.push(new Graph());
        this._funcitonSyms.push(prog.sym);
        //保存到Module中
        this.module.fun2Graph.set(this.functionSym, this.graph);
        //创建开始节点
        let startNode = new StartNode(new FakeControlNode);
        this.graph.addControlNode(startNode);
        //继续遍历
        super.visitProg(prog, startNode);
        //创建程序节点
        let functionNode = new FunctionNode("main", [], startNode);
        this.graph.addControlNode(functionNode);
        //恢复上下文
        this._graphs.pop();
        this._funcitonSyms.pop();
        return functionNode;
    }
    visitFunctionDecl(functinDecl, additional) {
        //设置上下文
        this._graphs.push(new Graph());
        this._funcitonSyms.push(functinDecl.sym);
        //保存到Module中
        this.module.fun2Graph.set(this.functionSym, this.graph);
        //创建函数节点和开始节点
        let startNode = new StartNode(new FakeControlNode);
        this.graph.addControlNode(startNode);
        //继续遍历
        super.visitFunctionDecl(functinDecl, startNode);
        //取出参数
        let params = [];
        let paramList = functinDecl.callSignature.paramList;
        if (paramList) {
            for (let paramDecl of paramList.params) {
                let paramNode = this.graph.getParameterNode(paramDecl.name);
                params.push(paramNode);
            }
        }
        //创建函数节点s
        let functionNode = new FunctionNode(functinDecl.name, params, startNode);
        this.graph.addControlNode(functionNode);
        //恢复上下文
        this._graphs.pop();
        this._funcitonSyms.pop();
        // return functionNode;
    }
    visitIfStatement(ifStmt, additional) {
        ////条件
        let conditionNode = this.visit(ifStmt.condition, additional);
        ////true分支        
        let begin1 = new BeginNode(new FakeControlNode());
        this.graph.addControlNode(begin1);
        let next1 = this.visit(ifStmt.stmt, begin1);
        let end1 = new EndNode();
        this.graph.addControlNode(end1);
        if (next1 instanceof UniSuccessorNode) {
            next1.next = end1;
        }
        else {
            begin1.next = end1;
        }
        ////false分支        
        let begin2 = new BeginNode(new FakeControlNode());
        this.graph.addControlNode(begin2);
        let next2 = this.visit(ifStmt.stmt, begin2);
        let end2 = new EndNode();
        this.graph.addControlNode(end2);
        if (next2 instanceof UniSuccessorNode) {
            next2.next = end2;
        }
        else {
            begin2.next = end2;
        }
        ////创建IfNode
        let ifNode = new IfNode(conditionNode, begin1, begin2);
        this.graph.addControlNode(ifNode);
        console_1.assert(additional instanceof UniSuccessorNode, "in visitIfStatement, prev node should be UniSuccessorNode");
        additional.next = ifNode;
        ////创建Merge节点
        let mergeNode = new MergeNode([end1, end2], new FakeControlNode());
        this.graph.addControlNode(mergeNode);
        return mergeNode;
    }
    visitBlock(block, additional) {
        console_1.assert(additional instanceof UniSuccessorNode, "in visitBlock, prev node should be UniSuccessorNode");
        let prevNode = additional;
        for (let stmt of block.stmts) {
            let node = this.visit(stmt, prevNode);
            if (node instanceof ControlNode) {
                if (node instanceof AbstractBeginNode) {
                    prevNode = node; //重新开启一个控制流
                }
                else {
                    prevNode.next = node; //替换掉原来的占位符
                    console_1.assert(node instanceof UniSuccessorNode, "in visitBlock, node should be UniSuccessorNode.");
                    prevNode = node;
                }
            }
        }
    }
    visitReturnStatement(rtnStmt, additional) {
        console_1.assert(additional instanceof UniSuccessorNode, "in visitReturnStatement, prev node should be UniSuccessorNode");
        let value = null;
        if (rtnStmt.exp) {
            value = this.visit(rtnStmt.exp, additional);
        }
        let rtnNode = new ReturnNode(value);
        this.graph.addControlNode(rtnNode);
        //接续控制流
        let prevNode = additional;
        prevNode.next = rtnNode;
        return rtnNode;
    }
    visitIntegerLiteral(literal, additional) {
        return this.handleLiteral(literal);
    }
    visitDecimalLiteral(literal, additional) {
        return this.handleLiteral(literal);
    }
    visitStringLiteral(literal, additional) {
        return this.handleLiteral(literal);
    }
    visitBooleanLiteral(literal, additional) {
        return this.handleLiteral(literal);
    }
    visitNullLiteral(literal, additional) {
        return this.handleLiteral(literal);
    }
    handleLiteral(literal) {
        let node = new ConstantNode(literal.value, literal.theType);
        return this.graph.addDataNode(node);
    }
    visitVariable(v, additional) {
        //左值：返回Symbol就好了
        if (v.isLeftValue) {
            return v.sym;
        }
        //右值：返回DataNode
        else {
            //如果是参数，获取ParameterNode
            if (this.functionSym.vars.indexOf(v.sym) < this.functionSym.getNumParams()) {
                let node = this.graph.getParameterNode(v.name);
                console_1.assert(node, "in visitVariable, 参数节点不应该为null");
                return node;
            }
            //如果是本地变量，那就要找到它的定义
            else {
                console_1.assert(additional instanceof ControlNode, "visitVariable的addtional参数应该是控制流");
                let beginNode = additional.beginNode;
                let varProxy = this.getVarProxyFromFlow(beginNode, v.sym);
                //为merge节点创建PhiNode
                if (!varProxy) {
                    if (beginNode instanceof AbstractMergeNode) {
                        let dataInputs = [];
                        for (let input of beginNode.inputs) {
                            let flow = input.beginNode;
                            let varProxy = this.getVarProxyFromFlow(flow, v.sym);
                            console_1.assert(varProxy, "创建PhiNode时，应该能查询到merge的每个输入流对应的变量的varSymbol");
                            let dataNode = this.graph.varProxy2Node.get(varProxy);
                            dataInputs.push(dataNode);
                        }
                        //创建phi节点
                        let phiNode = new PhiNode(beginNode, dataInputs, v.theType);
                        phiNode = this.graph.addDataNode(phiNode);
                        //创建新的VarSymbol，并跟当前的Flow绑定。
                        varProxy = this.graph.addVarDefinition(v.sym, phiNode);
                        this.setVarProxyForFlow(beginNode, v.sym, varProxy);
                        return phiNode;
                    }
                    else {
                        console.log("In visitVariable, cannot find var proxy for '" + v.name + "', and not after a merge node");
                    }
                }
                else {
                    return this.graph.varProxy2Node.get(varProxy);
                }
            }
        }
    }
    visitVariableDecl(variableDecl, additional) {
        //参数
        if (this.functionSym.vars.indexOf(variableDecl.sym) < this.functionSym.getNumParams()) {
            let node = new ParameterNode(variableDecl.name, variableDecl.theType);
            this.graph.addDataNode(node);
            return node;
        }
        //本地变量
        else {
            //生成变量的定义
            if (variableDecl.init) {
                let node = this.visit(variableDecl.init, additional);
                node = this.graph.addDataNode(node);
                //添加定义，返回一个VarProxy
                let varProxy = this.graph.addVarDefinition(variableDecl.sym, node);
                //设置当前流中应该使用哪个Proxy
                console_1.assert(additional instanceof ControlNode, "visitVariableDecl的addtional参数应该是控制流");
                let beginNode = additional.beginNode;
                this.setVarProxyForFlow(beginNode, variableDecl.sym, varProxy);
                return node;
            }
        }
    }
    visitBinary(binary, additional) {
        let node;
        //如果是赋值，那要看看是否需要生成新的变量，以符合SSA
        if (binary.op == scanner_1.Op.Assign) {
            let left = this.visit(binary.exp1, additional);
            let right = this.visit(binary.exp2, additional);
            console_1.assert(left instanceof symbol_1.VarSymbol, "在VisitBinary中，=左边应该返回一个VarSymbol");
            console_1.assert(right instanceof DataNode, "在VisitBinary中，=左边应该是一个DataNode");
            node = this.graph.addDataNode(right);
            //添加定义，返回一个VarProxy。如果该变量多次被定义，那么会返回多个不同版本的VarProxy
            let varProxy = this.graph.addVarDefinition(left, node);
            //设置当前流中应该使用哪个Proxy
            console_1.assert(additional instanceof ControlNode, "visitVariableDecl的addtional参数应该是控制流");
            let beginNode = additional.beginNode;
            this.setVarProxyForFlow(beginNode, left, varProxy);
        }
        else {
            let left = this.visit(binary.exp1, additional);
            let right = this.visit(binary.exp2, additional);
            node = new BinaryOpNode(left, right, binary.op, binary.theType);
            node = this.graph.addDataNode(node);
        }
        return node;
    }
}
exports.IRGenerator = IRGenerator;
/**
 * 把Graph生成点图
 */
class GraphPainter {
    static toDot(graph) {
        let str = "digraph{\n";
        for (let node of graph.nodes) {
            if (node instanceof UniSuccessorNode) {
                str += "\t" + node.label + " -> " + node.next.label + "\n";
                if (node instanceof AbstractMergeNode) {
                    for (let input of node.inputs) {
                        str += "\t" + node.label + " -> " + input.label + "\n";
                    }
                }
            }
            else if (node instanceof IfNode) {
                str += "\t" + node.label + " -> " + node.condition.label + "\n";
                str += "\t" + node.label + " -> " + node.trueBranch.label + "\n";
                str += "\t" + node.label + " -> " + node.falseBranch.label + "\n";
            }
            else if (node instanceof DataNode) {
                for (let input of node.inputs) {
                    str += "\t" + node.label + " -> " + input.label + "\n";
                }
                if (node instanceof PhiNode) {
                    str += "\t" + node.label + " -> " + node.mergeNode.label + "\n";
                }
                else if (node instanceof ReturnNode && node.value) {
                    str += "\t" + node.label + " -> " + node.value.label + "\n";
                }
            }
        }
        str += "}\n";
        return str;
    }
}
exports.GraphPainter = GraphPainter;
