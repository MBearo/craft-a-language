/**
 * 第1节
 * 本节的目的是迅速的实现一个最精简的语言的功能，让你了解一门计算机语言的骨架。
 * 知识点：
 * 1.递归下降的方法做词法分析；
 * 2.语义分析中的引用消解（找到函数的定义）；
 * 3.通过遍历AST的方法，执行程序。
 * 
 * 本节采用的语法规则是极其精简的，只能定义函数和调用函数。定义函数的时候，还不能有参数。
 * prog = (functionDecl | functionCall)* ;
 * functionDecl: "function" Identifier "(" ")"  functionBody;
 * functionBody : '{' functionCall* '}' ;
 * functionCall : Identifier '(' parameterList? ')' ;
 * parameterList : StringLiteral (',' StringLiteral)* ;
 */

/////////////////////////////////////////////////////////////////////////
// 词法分析
// 本节没有提供词法分析器，直接提供了一个Token串。语法分析程序可以从Token串中依次读出
// 一个个Token，也可以重新定位Token串的当前读取位置。

//Token的类型
enum TokenKind {
    Keyword,
    Identifier,
    StringLiteral,
    Seperator,
    Operator,
    EOF
};

// 代表一个Token的数据结构
interface Token {
    kind: TokenKind;
    text: string;
}

// 一个Token数组，代表了下面这段程序做完词法分析后的结果：
/*
//一个函数的声明，这个函数很简单，只打印"Hello World!"
function sayHello(){
    println("Hello World!");
}
//调用刚才声明的函数
sayHello();
*/
let tokenArray: Token[] = [
    { kind: TokenKind.Keyword, text: 'function' },
    { kind: TokenKind.Identifier, text: 'sayHello' },
    { kind: TokenKind.Seperator, text: '(' },
    { kind: TokenKind.Seperator, text: ')' },
    { kind: TokenKind.Seperator, text: '{' },
    { kind: TokenKind.Identifier, text: 'println' },
    { kind: TokenKind.Seperator, text: '(' },
    { kind: TokenKind.StringLiteral, text: 'Hello World!' },
    { kind: TokenKind.Seperator, text: ')' },
    { kind: TokenKind.Seperator, text: ';' },
    { kind: TokenKind.Seperator, text: '}' },
    { kind: TokenKind.Identifier, text: 'sayHello' },
    { kind: TokenKind.Seperator, text: '(' },
    { kind: TokenKind.Seperator, text: ')' },
    { kind: TokenKind.Seperator, text: ';' },
    { kind: TokenKind.EOF, text: '' }
];

class Tokenizer {
    pos: number = 0
    tokens: Token[] = [];
    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }
    next = () => {
        if (this.pos >= this.tokens.length) {
            // 返回EOF，最后一个就是他，所以直接给最后一个就行
            return this.tokens[this.tokens.length - 1]
        }
        return this.tokens[this.pos++];
    }
    position = () => {
        return this.pos;
    }
    traceBack = (newPos: number) => {
        this.pos = newPos;
    }
}

// 抄的，不知道干嘛的
abstract class AstNode {
    //原注释：打印对象信息，prefix是前面填充的字符串，通常用于缩进显示
    abstract dump(prefix: string): void;
}

abstract class Statement extends AstNode {
    // is 用的不懂
    static isStatementNode(node: AstNode): node is Statement {
        // return node instanceof Statement;
        if (!node) {
            return false;
        }
        else {
            return true;
        }
    }
}

class Prog extends AstNode {
    stmts: Statement[] = [];
    constructor(stmts: Statement[]) {
        super();
        this.stmts = stmts;
    }
    dump(prefix: string) {
        console.log(prefix + 'Prog');
        this.stmts.forEach(stmt => stmt.dump(prefix + '\t'));
    }
}

/**
 * 函数声明节点
 */
class FunctionDecl extends Statement {
    name: string;       //函数名称
    body: FunctionBody; //函数体
    constructor(name: string, body: FunctionBody) {
        super();
        this.name = name;
        this.body = body;
    }
    public dump(prefix: string): void {
        console.log(prefix + "FunctionDecl " + this.name);
        this.body.dump(prefix + "\t");
    }
}

/**
 * 函数体
 */
class FunctionBody extends AstNode {
    stmts: FunctionCall[];
    constructor(stmts: FunctionCall[]) {
        super();
        this.stmts = stmts;
    }
    static isFunctionBodyNode(node: any): node is FunctionBody {
        if (!node) {
            return false;
        }
        return node instanceof FunctionBody
    }
    public dump(prefix: string): void {
        console.log(prefix + "FunctionBody");
        this.stmts.forEach(x => x.dump(prefix + "\t"));
    }
}

/**
 * 函数调用
 */
class FunctionCall extends Statement {
    name: string;
    parameters: string[];
    definition: FunctionDecl | null = null;  //指向函数的声明
    constructor(name: string, parameters: string[]) {
        super();
        this.name = name;
        this.parameters = parameters;
    }
    static isFunctionCallNode(node: any): node is FunctionCall {
        if (!node) {
            return false;
        }
        // 简化下
        return node instanceof FunctionCall
    }
    public dump(prefix: string): void {
        console.log(prefix + "FunctionCall " + this.name + (this.definition != null ? ", resolved" : ", not resolved"));
        this.parameters.forEach(x => console.log(prefix + "\t" + "Parameter: " + x));
    }
}

class Parser {
    tokenizer: Tokenizer;
    constructor(tokenizer: Tokenizer) {
        this.tokenizer = tokenizer;
    }
    parseProg = (): Prog => {
        let stmts: Statement[] = [];
        let stmt: Statement | null | void = null
        while (true) {
            stmt = this.parseFunctionDecl();
            if (Statement.isStatementNode(stmt)) {
                stmts.push(stmt);
                continue
            }
            stmt = this.parseFunctionCall()
            if (Statement.isStatementNode(stmt)) {
                stmts.push(stmt);
                continue
            }
            if (stmt === null) {
                break;
            }
        }
        return new Prog(stmts);
    }
    parseFunctionDecl = (): FunctionDecl | null | void => {
        let oldPos: number = this.tokenizer.position();
        let t: Token = this.tokenizer.next();
        if (t.kind === TokenKind.Keyword && t.text === 'function') {
            t = this.tokenizer.next();
            if (t.kind === TokenKind.Identifier) {
                let t1 = this.tokenizer.next();
                if (t1.text = '(') {
                    let t2 = this.tokenizer.next();
                    if (t2.text = ')') {
                        let functionBody = this.parseFunctionBody()
                        if (FunctionBody.isFunctionBodyNode(functionBody)) {
                            return new FunctionDecl(t.text, functionBody);
                        }
                    } else {
                        console.log("Expecting ')' in FunctionDecl, while we got a " + t.text);
                        return;
                    }
                } else {
                    console.log("Expecting '(' in FunctionDecl, while we got a " + t.text);
                    return;
                }
            }
        }
        this.tokenizer.traceBack(oldPos);
        return null;
    }
    parseFunctionCall(): FunctionCall | null | void {
        let oldPos: number = this.tokenizer.position();
        let params: string[] = [];
        let t: Token = this.tokenizer.next();
        if (t.kind == TokenKind.Identifier) {
            let t1: Token = this.tokenizer.next();
            if (t1.text == "(") {
                let t2: Token = this.tokenizer.next();
                //循环，读出所有
                while (t2.text != ")") {
                    if (t2.kind == TokenKind.StringLiteral) {
                        params.push(t2.text);
                    }
                    else {
                        console.log("Expecting parameter in FunctionCall, while we got a " + t2.text);
                        return;  //出错时，就不在错误处回溯了。
                    }
                    t2 = this.tokenizer.next();
                    if (t2.text != ")") {
                        if (t2.text == ",") {
                            t2 = this.tokenizer.next();
                        }
                        else {
                            console.log("Expecting a comma in FunctionCall, while we got a " + t2.text);
                            return;
                        }
                    }
                }
                //消化掉一个分号：;
                t2 = this.tokenizer.next();
                if (t2.text == ";") {
                    return new FunctionCall(t.text, params);
                }
                else {
                    console.log("Expecting a comma in FunctionCall, while we got a " + t2.text);
                    return;
                }
            }
        }

        //如果解析不成功，回溯，返回null。
        this.tokenizer.traceBack(oldPos);
        return null;
    }
    parseFunctionBody(): FunctionBody | null | void {
        let oldPos: number = this.tokenizer.position();
        let stmts: FunctionCall[] = [];
        let t: Token = this.tokenizer.next();
        if (t.text == "{") {
            let functionCall = this.parseFunctionCall();
            while (FunctionCall.isFunctionCallNode(functionCall)) {  //解析函数体
                stmts.push(functionCall);
                functionCall = this.parseFunctionCall();
            }
            t = this.tokenizer.next();
            if (t.text == "}") {
                return new FunctionBody(stmts);
            }
            else {
                console.log("Expecting '}' in FunctionBody, while we got a " + t.text);
                return;
            }
        }
        else {
            console.log("Expecting '{' in FunctionBody, while we got a " + t.text);
            return;
        }

        // 这里没走。。不太懂
        //如果解析不成功，回溯，返回null。
        this.tokenizer.traceBack(oldPos);
        return null;
    }
}
abstract class AstVisitor {
    visitProg(prog: Prog): any {
        let retVal: any;
        prog.stmts.forEach(stmt => {
            if (typeof (stmt as FunctionDecl).body === 'object') {
                retVal = this.visitFunctionDecl(stmt as FunctionDecl);
            } else {
                retVal = this.visitFunctionCall(stmt as FunctionCall);
            }
        })
        return retVal;
    }
    visitFunctionDecl(functionDecl: FunctionDecl): any {
        return this.visitFunctionBody(functionDecl.body)
    }

    visitFunctionBody(functionBody: FunctionBody): any {
        let retVal: any;
        functionBody.stmts.forEach(stmt => {
            retVal = this.visitFunctionCall(stmt);
        })
    }
    visitFunctionCall(functionCall: FunctionCall): any {
        return undefined
    }
}