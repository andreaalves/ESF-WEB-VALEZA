import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react";
import React from "react";

interface IExcludeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  deleteFunction: (e: any) => void;
}

export function ExcludeDialog({
  isOpen,
  onClose,
  label,
  deleteFunction,
}: IExcludeDialogProps) {
  const cancelRef = React.useRef<any>();

  return (
    <>
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.900">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Excluir {label}
            </AlertDialogHeader>

            <AlertDialogBody>Você tem certeza?</AlertDialogBody>

            <AlertDialogFooter>
              <Button
                variant="outline"
                colorScheme="red"
                ref={cancelRef}
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button colorScheme="red" onClick={deleteFunction} ml={3}>
                Deletar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
