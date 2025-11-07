import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setContents = useFile(state => state.setContents);
  const getContents = useFile(state => state.getContents);
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedContent, setEditedContent] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (opened && nodeData) {
      setEditedContent(normalizeNodeData(nodeData.text ?? []));
      setIsEditing(false);
      setError("");
    }
  }, [opened, nodeData]);

  const handleEdit = () => {
    setIsEditing(true);
    setError("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(normalizeNodeData(nodeData?.text ?? []));
    setError("");
  };

  const handleSave = () => {
    try {
      // Validate the edited JSON
      const parsedEdits = JSON.parse(editedContent);
      
      // Get the current JSON data from the editor contents
      const currentJson = JSON.parse(getContents());
      
      // Get the path to the node
      const path = nodeData?.path ?? [];
      
      // Update the value at the specified path
      if (path.length === 0) {
        // If path is empty, replace the entire JSON
        setContents({ contents: JSON.stringify(parsedEdits, null, 2) });
      } else {
        // Navigate to the node location
        let current = currentJson;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]];
        }
        
        const lastKey = path[path.length - 1];
        const targetNode = current[lastKey];
        
        // If we're editing a primitive value (string, number, boolean, null)
        if (typeof targetNode !== 'object' || targetNode === null) {
          // Replace the primitive value directly
          current[lastKey] = parsedEdits;
        } else {
          // If it's an object/array, we need to merge the edited values with the existing structure
          // The parsedEdits will only contain the primitive key-value pairs we showed in the modal
          if (typeof parsedEdits === 'object' && parsedEdits !== null && !Array.isArray(parsedEdits)) {
            // For objects, update only the primitive keys that were in the modal
            Object.keys(parsedEdits).forEach(key => {
              targetNode[key] = parsedEdits[key];
            });
          } else {
            // If the edited content is not an object (e.g., user changed it to a primitive), replace it
            current[lastKey] = parsedEdits;
          }
        }
        
        // Update the editor contents, which will automatically update the graph
        setContents({ contents: JSON.stringify(currentJson, null, 2) });
      }
      
      setIsEditing(false);
      setError("");
      onClose();
    } catch (err) {
      setError("Invalid JSON format");
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Flex justify="space-between" align="center">
          <Text fz="lg" fw={600}>
            Node Content
          </Text>
          <CloseButton onClick={onClose} />
        </Flex>
        
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Group gap="xs">
              {isEditing ? (
                <>
                    <Button size="xs" onClick={handleSave} color="green">
                    Save
                    </Button>
                  <Button size="xs" variant="default" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="xs" onClick={handleEdit}>
                  Edit
                </Button>
              )}
            </Group>
          </Flex>
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.currentTarget.value)}
              autosize
              minRows={3}
              styles={{ input: { fontFamily: "monospace", fontSize: "12px" } }}
              error={error}
            />
          ) : (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={editedContent}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}
        </Stack>
        
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
