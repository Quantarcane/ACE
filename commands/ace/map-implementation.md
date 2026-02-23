---
name: ace:map-implementation
description: Analyze a story implementation (artifacts and code) to create or update .docs/wiki/subsystems/ documents and to update .docs/wiki/system-wide/ documents
argument-hint: "[artifacts=<path>, commits=x]"
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
        - After a story has been implemented
	</execution-time>
	
    <input>
        <flags>
		</flags>
        
        <parameters>
            <required>
                **artifacts** TODO take from existing command!.
			</required>
			
            <optional>
			</optional>
        </parameters>
    </input>

    <execution-context>
    </execution-context>

    <output>
        <objective>
        </objective>
        
        <artifacts>
        </artifacts>
    </output>
    
    <process>
    </process>
    
    <next-steps>
    </next-steps>

</command>
```