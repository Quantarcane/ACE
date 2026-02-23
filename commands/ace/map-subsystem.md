---
name: ace:map-system
description: Analyze system-wide codebase with parallel code-wiki-mapper agents to produce .docs/wiki/system-wide/ documents
argument-hint: "[(optional)references='existing artifacts and documents to be considered alongside the codebase']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---

```xml
<command>
	
	<execution-time>
        **This command can run:**
        - After /ace:map-system or whenever a new subsystem needs to be documented
        - Anytime to refresh an existing subsystem
	</execution-time>
	
    <input>
        <flags>
		</flags>
        
        <parameters>
            <required>
                <param name="subsystem" type="path|text">
                    - If not provided, pause execution and ask the user for it.
                    - If provided, the subsystem must be mapped, AND the system-wide documents from `.docs/wiki/system-wide/` must be updated IF necessary.
                    - If provided but ambiguous, or you cannot find the subsystem in code, ask the user clarifying questions.
                </param>
			</required>
			
            <optional>
			</optional>
        </parameters>
    </input>

    <execution-context>
        - First read all the system-wide documents: `.docs/wiki/system-wide/`
    </execution-context>

    <output>
        <objective>
            Map the codebase producing documents
        </objective>
        
        <artifacts>
        </artifacts>
    </output>
    
    <process>
        <system-wide-workflow></system-wide-workflow>
    </process>
    
    <next-steps>
    </next-steps>

</command>
```