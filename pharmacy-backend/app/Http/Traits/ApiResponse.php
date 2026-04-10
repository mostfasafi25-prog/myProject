<?php

namespace App\Http\Traits;

use Illuminate\Http\JsonResponse;

trait ApiResponse
{
    protected function success($data = null, string $message = '', int $code = 200): JsonResponse
    {
        $body = ['success' => true];
        if ($message !== '') {
            $body['message'] = $message;
        }
        if ($data !== null) {
            $body['data'] = $data;
        }
        return response()->json($body, $code);
    }

    protected function error(string $message, int $code = 400, $errors = null): JsonResponse
    {
        $body = ['success' => false, 'message' => $message];
        if ($errors !== null) {
            $body['errors'] = $errors;
        }
        return response()->json($body, $code);
    }

    protected function validationError($errors, string $message = 'خطأ في التحقق من البيانات'): JsonResponse
    {
        return $this->error($message, 422, $errors);
    }
}
